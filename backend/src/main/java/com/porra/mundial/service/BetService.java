package com.porra.mundial.service;

import com.porra.mundial.model.Bet;
import com.porra.mundial.model.BetBackup;
import com.porra.mundial.repository.BetBackupRepository;
import com.porra.mundial.repository.BetRepository;
import com.porra.mundial.repository.UserAccountRepository;
import com.porra.mundial.repository.EditionRepository;
import com.porra.mundial.repository.MembershipRepository;
import com.porra.mundial.model.UserAccount;
import com.porra.mundial.model.Edition;
import com.porra.mundial.model.Membership;
import com.porra.mundial.dto.BetDataDTO;
import com.porra.mundial.dto.BetResponseDTO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * ️ Servicio de Apuestas (BetService).
 * Encargado de orquestar todo el ciclo de vida de una Porra/Apuesta (Crear, Actualizar, Borrar, Pagar).
 * También delega en PredictionPersistenceService para persistir el "Bracket" y el "Group Phase" de la apuesta.
 */
@Slf4j
@Service
@Transactional
@RequiredArgsConstructor
public class BetService {

    private final BetRepository betRepository;
    private final BetBackupRepository betBackupRepository;
    private final UserAccountRepository userAccountRepository;
    private final EditionRepository editionRepository;
    private final PredictionPersistenceService predictionPersistenceService;
    private final MembershipRepository membershipRepository;

    @org.springframework.beans.factory.annotation.Value("${app.admins:Admin}")
    private List<String> appAdmins;

    @org.springframework.beans.factory.annotation.Value("${app.admin-emails:raclosdev@gmail.com,raclosnegocios@gmail.com}")
    private List<String> adminEmails;

    public boolean isSuperAdmin(String email) {
        if (email == null || email.isBlank()) return false;
        if (adminEmails != null && adminEmails.stream().anyMatch(ae -> ae.equalsIgnoreCase(email))) {
            return true;
        }
        if (appAdmins != null && appAdmins.stream().anyMatch(a -> a.equalsIgnoreCase(email))) {
            return true;
        }
        return userAccountRepository.findByGoogleEmail(email)
                .map(UserAccount::isSuperadmin)
                .orElse(false);
    }

    public void verifyBetOwnershipOrAdmin(Bet bet, String requesterEmail) {
        if (requesterEmail == null || requesterEmail.isBlank()) {
            throw new SecurityException("Usuario no autenticado");
        }
        if (isSuperAdmin(requesterEmail)) {
            return;
        }
        if (bet.getUser() != null && bet.getUser().getGoogleEmail() != null
                && bet.getUser().getGoogleEmail().equalsIgnoreCase(requesterEmail)) {
            return;
        }
        if (bet.getEdition() != null && bet.getEdition().getLeague() != null
                && bet.getEdition().getLeague().getAdminUser() != null
                && bet.getEdition().getLeague().getAdminUser().getGoogleEmail() != null
                && bet.getEdition().getLeague().getAdminUser().getGoogleEmail().equalsIgnoreCase(requesterEmail)) {
            return;
        }
        throw new SecurityException("No tienes permiso para modificar o eliminar esta apuesta.");
    }

    public void verifyGroupAdminForPayment(Bet bet, String requesterEmail) {
        if (requesterEmail == null || requesterEmail.isBlank()) {
            throw new SecurityException("Usuario no autenticado");
        }
        if (isSuperAdmin(requesterEmail)) {
            return;
        }
        if (bet.getEdition() != null && bet.getEdition().getLeague() != null
                && bet.getEdition().getLeague().getAdminUser() != null
                && bet.getEdition().getLeague().getAdminUser().getGoogleEmail() != null
                && bet.getEdition().getLeague().getAdminUser().getGoogleEmail().equalsIgnoreCase(requesterEmail)) {
            return;
        }
        throw new SecurityException("Solo el administrador del grupo puede marcar la apuesta como pagada.");
    }

    /**
     * Guarda una instantánea o backup de la apuesta en el estado actual.
     * @param bet Apuesta a respaldar.
     * @param action Acción que provocó el backup (ej. "CREATED", "SNAPSHOT").
     */
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

    /**
     * Crea un backup inicial para todas las apuestas que no lo tengan.
     * Útil para migraciones o despliegues iniciales.
     */
    public void createOneTimeSnapshot() {
        betRepository.findAll().forEach(bet -> {
            if (betBackupRepository.findByOriginalBetIdOrderByBackupTimestampDesc(bet.getId()).isEmpty()) {
                saveBackup(bet, "SNAPSHOT");
            }
        });
    }

    /**
     * @return Todas las apuestas registradas en el sistema.
     */
    @Transactional(readOnly = true)
    public List<Bet> getAllBets() {
        return betRepository.findAllByOrderByCreatedAtDesc();
    }

    /**
     * @param groupId ID del grupo.
     * @return Todas las apuestas pertenecientes a un grupo/liga concreto.
     */
    @Transactional(readOnly = true)
    public List<Bet> getBetsByGroupId(Long groupId) {
        return betRepository.findByEditionLeagueId(groupId);
    }

    /**
     * @param email Email del usuario en Google.
     * @return Todas las apuestas que ha realizado este usuario.
     */
    @Transactional(readOnly = true)
    public List<Bet> getBetsByGoogleEmail(String email) {
        return betRepository.findByUserGoogleEmail(email);
    }

    /**
     * @return Todas las apuestas que ya han pagado su inscripción (solo para el Leaderboard).
     */
    @Transactional(readOnly = true)
    public List<Bet> getPaidBets() {
        return betRepository.findByPaymentStatus("PAID");
    }

    /**
     * @param id ID de la apuesta.
     * @return Optional con la apuesta si existe.
     */
    @Transactional(readOnly = true)
    public Optional<Bet> findById(Long id) {
        return betRepository.findById(id);
    }

    /**
     * Registra una nueva porra enviada por el usuario.
     * Si el usuario ya tenía una apuesta en ese grupo, la borra (solo se permite 1 por grupo).
     * @param email Email del usuario que la manda.
     * @param betName Nombre personalizable de la apuesta.
     * @param betData Los pronósticos (Grupos, Cuadro, Pichichi).
     * @param groupId El grupo donde compite.
     * @return La nueva apuesta persistida.
     */
    @org.springframework.cache.annotation.CacheEvict(value = {"leaderboard", "userGroups", "allBetsDto", "myBetsDto", "rebuiltBetData"}, allEntries = true)
    public Bet createBet(String email, String betName, BetDataDTO betData, Long groupId) {
        if (groupId != null) {
            betRepository.findByUserGoogleEmailAndEditionLeagueId(email, groupId)
                .ifPresent(betRepository::delete);
        }
        
        UserAccount user = userAccountRepository.findByGoogleEmail(email).orElse(null);
        Edition edition = groupId != null ? editionRepository.findByLeagueIdAndStatus(groupId, "ACTIVE").orElse(null) : null;

        Bet bet = betRepository.save(Bet.builder()
                .user(user)
                .edition(edition)
                .betName(betName)
                .paymentStatus("PENDING")
                .createdAt(LocalDateTime.now())
                .build());
        
        // Transforma el JSON del frontend a filas SQL relacionales
        predictionPersistenceService.saveRelationalPredictions(bet, betData);
        
        if (groupId != null && user != null) {
            Membership.MembershipId memId = new Membership.MembershipId(user.getId(), groupId);
            if (!membershipRepository.existsById(memId)) {
                membershipRepository.save(Membership.builder()
                        .id(memId)
                        .user(user)
                        .league(edition.getLeague())
                        .role("MEMBER")
                        .build());
            }
        }
        
        return bet;
    }

    /**
     * Permite modificar el nombre de la apuesta o los pronósticos si la competición no ha cerrado.
     */
    @org.springframework.cache.annotation.CacheEvict(value = {"leaderboard", "userGroups", "allBetsDto", "myBetsDto", "rebuiltBetData"}, allEntries = true)
    public Bet updateBet(Long id, String requesterEmail, String participantName, String betName, BetDataDTO betData) {
        Bet bet = betRepository.findById(id).orElseThrow(() -> new NoSuchElementException("Porra no encontrada: " + id));
        verifyBetOwnershipOrAdmin(bet, requesterEmail);
        if (participantName != null) bet.setParticipantName(participantName);
        if (betName != null) bet.setBetName(betName);
        
        bet = betRepository.save(bet);
        if (betData != null) predictionPersistenceService.saveRelationalPredictions(bet, betData);
        
        return bet;
    }

    public Bet updateBet(Long id, String participantName, String betName, BetDataDTO betData) {
        return updateBet(id, null, participantName, betName, betData);
    }

    /**
     * Marca una apuesta como pagada. A partir de este momento, aparecerá en el Leaderboard oficial.
     */
    @org.springframework.cache.annotation.CacheEvict(value = {"leaderboard", "userGroups", "allBetsDto", "myBetsDto", "rebuiltBetData"}, allEntries = true)
    public Bet markAsPaid(Long id, String requesterEmail) {
        Bet bet = betRepository.findById(id).orElseThrow(() -> new NoSuchElementException("Porra no encontrada: " + id));
        verifyGroupAdminForPayment(bet, requesterEmail);
        bet.setPaid(true);
        if (requesterEmail != null) {
            userAccountRepository.findByGoogleEmail(requesterEmail).ifPresent(bet::setPaymentMarkedBy);
        }
        return betRepository.save(bet);
    }

    public Bet markAsPaid(Long id) {
        return markAsPaid(id, null);
    }

    /**
     * Borra permanentemente una apuesta del sistema.
     */
    @org.springframework.cache.annotation.CacheEvict(value = {"leaderboard", "userGroups", "allBetsDto", "myBetsDto", "rebuiltBetData"}, allEntries = true)
    public void deleteBet(Long id, String requesterEmail) {
        Bet bet = betRepository.findById(id).orElseThrow(() -> new NoSuchElementException("Porra no encontrada: " + id));
        verifyBetOwnershipOrAdmin(bet, requesterEmail);
        betRepository.delete(bet);
    }

    public void deleteBet(Long id) {
        deleteBet(id, null);
    }

    /**
     * Restaura una apuesta utilizando la información histórica de la tabla de backups.
     */
    @org.springframework.cache.annotation.CacheEvict(value = {"leaderboard", "userGroups", "allBetsDto", "myBetsDto", "rebuiltBetData"}, allEntries = true)
    public Bet restoreBet(Long backupId) {
        BetBackup backup = betBackupRepository.findById(backupId)
                .orElseThrow(() -> new NoSuchElementException("Backup no encontrado: " + backupId));
        
        Bet bet = betRepository.findById(backup.getOriginalBetId()).orElseGet(Bet::new);
        bet.setId(backup.getOriginalBetId());
        bet.setParticipantName(backup.getParticipantName());
        bet.setBetName(backup.getBetName());
        bet.setPaid(backup.getPaid());
        
        bet = betRepository.save(bet);
        saveBackup(bet, "RESTORED_FROM_" + backupId);
        return bet;
    }

    /**
     * @param bets Lista de Entidades JPA.
     * @return Lista de DTOs mapeados y listos para enviar por JSON al Frontend.
     */
    public List<BetResponseDTO> toBetDtoList(List<Bet> bets) {
        return bets.stream().map(bet -> {
            BetDataDTO dataDto = null;
            try {
                dataDto = getBetData(bet.getId());
            } catch (Exception e) {
                log.warn("Failed to retrieve bet data for bet ID {}: {}", bet.getId(), e.getMessage());
            }

            return BetResponseDTO.builder()
                    .key(bet.getId().toString())
                    .hash(bet.getId().toString())
                    .paid(bet.getPaid())
                    .participantName(bet.getParticipantName())
                    .userId(bet.getUser() != null ? bet.getUser().getId() : null)
                    .betName(bet.getBetName())
                    .groupId(bet.getGroupId())
                    .data(dataDto)
                    .build();
        }).collect(Collectors.toList());
    }

    /**
     * @param id ID de la apuesta.
     * @return El DTO consolidado con todos los pronósticos estructurados (Grupos, Bracket, Pichichi).
     */
    @Transactional(readOnly = true)
    public BetDataDTO getBetData(Long id) {
        Bet bet = betRepository.findById(id).orElseThrow(() -> new NoSuchElementException("Bet not found"));
        BetDataDTO dto = predictionPersistenceService.rebuildBetDataDtoFromTables(id);
        dto.setUser(bet.getParticipantName());
        dto.setBet(bet.getBetName());
        return dto;
    }
}
