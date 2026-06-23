package com.porra.mundial.service;

import com.porra.mundial.model.Bet;
import com.porra.mundial.model.BetBackup;
import com.porra.mundial.repository.BetBackupRepository;
import com.porra.mundial.repository.BetRepository;
import com.porra.mundial.repository.UserAccountRepository;
import com.porra.mundial.repository.EditionRepository;
import com.porra.mundial.model.UserAccount;
import com.porra.mundial.model.Edition;
import com.porra.mundial.dto.BetDataDTO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

/**
 * 🛠️ Servicio de Apuestas
 * Es el "cerebro" que se encarga de gestionar las porras que envía la gente.
 * Aquí validamos cosas antes de guardarlas en la base de datos o prepararlas para la web.
 */
@Service
@Transactional
@RequiredArgsConstructor
public class BetService {

    private final BetRepository betRepository;
    private final BetBackupRepository betBackupRepository;
    private final UserAccountRepository userAccountRepository;
    private final EditionRepository editionRepository;
    private final HashTransitionService hashTransitionService;

    private void saveBackup(Bet bet, String action) {
        if (bet == null) return;
        BetBackup backup = BetBackup.builder()
                .originalBetId(bet.getId())
                .participantName(bet.getParticipantName())
                .betName(bet.getBetName())
                .paid(bet.getPaid())
                .action(action)
                .backupTimestamp(LocalDateTime.now())
                .build();
        betBackupRepository.save(backup);
    }

    // 📸 Crea una foto o copia de seguridad estática de todas las apuestas actuales
    public void createOneTimeSnapshot() {
        List<Bet> allBets = betRepository.findAll();
        for (Bet bet : allBets) {
            // Check if backup already exists to avoid duplicates
            if (betBackupRepository.findByOriginalBetIdOrderByBackupTimestampDesc(bet.getId()).isEmpty()) {
                saveBackup(bet, "SNAPSHOT");
            }
        }
    }

    // Recupera todas las porras desde el disco duro
    public List<Bet> getAllBets() {
        return betRepository.findAllByOrderByCreatedAtDesc();
    }

    public List<Bet> getBetsByGroupId(Long groupId) {
        return betRepository.findByEditionLeagueId(groupId);
    }

    public List<Bet> getBetsByGoogleEmail(String email) {
        return betRepository.findByUserGoogleEmail(email);
    }

    // Recupera solo las porras que ya han pagado
    public List<Bet> getPaidBets() {
        return betRepository.findByPaymentStatus("PAID");
    }

    // Busca una porra concreta por su ID
    public Optional<Bet> findById(Long id) {
        return betRepository.findById(id);
    }

    // Crea una porra nueva desde cero cuando alguien le da a "Enviar" en la web
    public Bet createBet(String email, String betName, BetDataDTO betData, Long groupId) {
        // Remove existing bet for this user in this group if it exists
        if (groupId != null) {
            betRepository.findByUserGoogleEmailAndEditionLeagueId(email, groupId).ifPresent(existingBet -> {
                betRepository.delete(existingBet);
            });
        }
        
        UserAccount user = userAccountRepository.findByGoogleEmail(email).orElse(null);
        Edition edition = null;
        if (groupId != null) {
            edition = editionRepository.findByLeagueIdAndStatus(groupId, "ACTIVE").orElse(null);
        }

        Bet bet = Bet.builder()
                .user(user)
                .edition(edition)
                .betName(betName)
                .paymentStatus("PENDING") // Por defecto, nadie paga hasta que el admin lo diga
                .createdAt(LocalDateTime.now())
                .build();
        bet = betRepository.save(bet);
        
        // Populate the relational tables
        hashTransitionService.saveRelationalPredictions(bet, betData);
        return bet;
    }

    // Permite al admin corregir un nombre o actualizar la porra si hubo un error
    public Bet updateBet(Long id, String participantName, String betName, BetDataDTO betData) {
        Bet bet = betRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Porra no encontrada: " + id));
        if (participantName != null) bet.setParticipantName(participantName);
        if (betName != null) bet.setBetName(betName);
        bet = betRepository.save(bet);
        if (betData != null) {
            hashTransitionService.saveRelationalPredictions(bet, betData);
        }
        return bet;
    }

    // ¡Bling! Marca que un usuario ya ha hecho su bizum de 10 euritos
    public Bet markAsPaid(Long id) {
        Bet bet = betRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Porra no encontrada: " + id));
        bet.setPaid(true);
        return betRepository.save(bet);
    }

    // Elimina una porra si era spam o repetida
    public void deleteBet(Long id) {
        betRepository.deleteById(id);
    }

    // 🪄 Restaura una apuesta borrada o machacada a partir de un backup
    public Bet restoreBet(Long backupId) {
        BetBackup backup = betBackupRepository.findById(backupId)
                .orElseThrow(() -> new NoSuchElementException("Backup no encontrado: " + backupId));
        
        Bet bet = betRepository.findById(backup.getOriginalBetId()).orElse(new Bet());
        bet.setId(backup.getOriginalBetId()); // Mantener el mismo ID
        bet.setParticipantName(backup.getParticipantName());
        bet.setBetName(backup.getBetName());
        bet.setPaid(backup.getPaid());
        
        bet = betRepository.save(bet);
        saveBackup(bet, "RESTORED_FROM_" + backupId);
        // Note: Restoring from backup no longer restores predictions automatically unless we keep predictions in BetBackup
        return bet;
    }

    /**
     * 🌐 Este método es un "traductor".
     * Coge el formato feo de la base de datos (Java) y lo convierte en un 
     * diccionario amigable (JSON) que JavaScript puede entender a la perfección.
     */
    public List<Map<String, Object>> toBetDtoList(List<Bet> bets) {
        List<Map<String, Object>> result = new ArrayList<>();
        for (Bet bet : bets) {
            Map<String, Object> dto = new LinkedHashMap<>();
            dto.put("key", bet.getId().toString());
            // Add legacy hash field but put the ID inside so old frontend logic that passes 'hash' around still works
            dto.put("hash", bet.getId().toString());
            dto.put("paid", bet.getPaid());
            dto.put("participantName", bet.getParticipantName());
            dto.put("userId", bet.getUser() != null ? bet.getUser().getId() : null);
            dto.put("betName", bet.getBetName());
            dto.put("groupId", bet.getGroupId());
            try {
                dto.put("data", getBetData(bet.getId()));
            } catch (Exception e) {
                // If it fails to build, just don't include it rather than crashing
            }
            result.add(dto);
        }
        return result;
    }

    public BetDataDTO getBetData(Long id) {
        Bet bet = betRepository.findById(id).orElseThrow(() -> new NoSuchElementException("Bet not found"));
        BetDataDTO dto = hashTransitionService.rebuildBetDataDtoFromTables(id);
        dto.setUser(bet.getParticipantName());
        dto.setBet(bet.getBetName());
        return dto;
    }
}
