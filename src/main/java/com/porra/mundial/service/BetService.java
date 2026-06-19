package com.porra.mundial.service;

import com.porra.mundial.model.Bet;
import com.porra.mundial.model.BetBackup;
import com.porra.mundial.repository.BetBackupRepository;
import com.porra.mundial.repository.BetRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;

/**
 * 🛠️ Servicio de Apuestas
 * Es el "cerebro" que se encarga de gestionar las porras que envía la gente.
 * Aquí validamos cosas antes de guardarlas en la base de datos o prepararlas para la web.
 */
@Service
@RequiredArgsConstructor
public class BetService {

    private final BetRepository betRepository;
    private final BetBackupRepository betBackupRepository;

    private void saveBackup(Bet bet, String action) {
        if (bet == null) return;
        BetBackup backup = BetBackup.builder()
                .originalBetId(bet.getId())
                .participantName(bet.getParticipantName())
                .betName(bet.getBetName())
                .hash(bet.getHash())
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
        return betRepository.findByGroupId(groupId);
    }

    public List<Bet> getBetsByParticipantName(String participantName) {
        return betRepository.findByParticipantName(participantName);
    }

    // Recupera solo las porras que ya han pagado
    public List<Bet> getPaidBets() {
        return betRepository.findByPaidTrue();
    }

    // Busca una porra concreta por su ID
    public Optional<Bet> findById(Long id) {
        return betRepository.findById(id);
    }

    // Crea una porra nueva desde cero cuando alguien le da a "Enviar" en la web
    public Bet createBet(String participantName, String betName, String hash, Long groupId) {
        // Remove existing bet for this user in this group if it exists
        if (groupId != null) {
            betRepository.findByParticipantNameAndGroupId(participantName, groupId).ifPresent(existingBet -> {
                betRepository.delete(existingBet);
            });
        }
        Bet bet = Bet.builder()
                .participantName(participantName)
                .betName(betName)
                .hash(hash)
                .groupId(groupId)
                .paid(false) // Por defecto, nadie paga hasta que el admin lo diga
                .createdAt(LocalDateTime.now())
                .build();
        return betRepository.save(bet);
    }

    // Permite al admin corregir un nombre o actualizar el hash de una porra si hubo un error
    public Bet updateBet(Long id, String participantName, String betName, String hash) {
        Bet bet = betRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Porra no encontrada: " + id));
        if (participantName != null) bet.setParticipantName(participantName);
        if (betName != null) bet.setBetName(betName);
        if (hash != null) bet.setHash(hash);
        return betRepository.save(bet);
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
        bet.setHash(backup.getHash());
        bet.setPaid(backup.getPaid());
        
        bet = betRepository.save(bet);
        saveBackup(bet, "RESTORED_FROM_" + backupId);
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
            dto.put("hash", bet.getHash());
            dto.put("paid", bet.getPaid());
            dto.put("participantName", bet.getParticipantName());
            dto.put("betName", bet.getBetName());
            dto.put("groupId", bet.getGroupId());
            result.add(dto);
        }
        return result;
    }
}
