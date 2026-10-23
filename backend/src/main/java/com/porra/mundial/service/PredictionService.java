package com.porra.mundial.service;

import com.porra.mundial.dto.BetDataDTO;
import com.porra.mundial.dto.BetResponseDTO;
import com.porra.mundial.dto.PredictionResponseDTO;
import com.porra.mundial.model.Edition;
import com.porra.mundial.model.Membership;
import com.porra.mundial.model.Prediction;
import com.porra.mundial.model.PredictionBackup;
import com.porra.mundial.model.UserAccount;
import com.porra.mundial.repository.EditionRepository;
import com.porra.mundial.repository.MembershipRepository;
import com.porra.mundial.repository.PredictionBackupRepository;
import com.porra.mundial.repository.PredictionRepository;
import com.porra.mundial.repository.UserAccountRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Servicio principal de gestion de pronosticos y porras (Prediction).
 */
@Slf4j
@Service
@Transactional
@RequiredArgsConstructor
public class PredictionService {

    private final PredictionRepository predictionRepository;
    private final PredictionBackupRepository predictionBackupRepository;
    private final UserAccountRepository userAccountRepository;
    private final EditionRepository editionRepository;
    private final PredictionPersistenceService predictionPersistenceService;
    private final MembershipRepository membershipRepository;

    @Value("${app.admins:Admin}")
    private List<String> appAdmins;

    @Value("${app.admin-emails:raclosdev@gmail.com,raclosnegocios@gmail.com}")
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

    public void verifyPredictionOwnershipOrAdmin(Prediction prediction, String requesterEmail) {
        if (requesterEmail == null || requesterEmail.isBlank()) {
            throw new SecurityException("Usuario no autenticado");
        }

        if (isSuperAdmin(requesterEmail)) {
            return;
        }

        if (prediction.getUser() != null && prediction.getUser().getGoogleEmail() != null
                && prediction.getUser().getGoogleEmail().equalsIgnoreCase(requesterEmail)) {
            return;
        }

        if (prediction.getEdition() != null && prediction.getEdition().getLeague() != null
                && prediction.getEdition().getLeague().getAdminUser() != null
                && prediction.getEdition().getLeague().getAdminUser().getGoogleEmail() != null
                && prediction.getEdition().getLeague().getAdminUser().getGoogleEmail().equalsIgnoreCase(requesterEmail)) {
            return;
        }

        throw new SecurityException("No tienes permiso para modificar o eliminar este pronostico.");
    }

    public void verifyGroupAdminForPayment(Prediction prediction, String requesterEmail) {
        if (requesterEmail == null || requesterEmail.isBlank()) {
            throw new SecurityException("Usuario no autenticado");
        }

        if (isSuperAdmin(requesterEmail)) {
            return;
        }

        if (prediction.getEdition() != null && prediction.getEdition().getLeague() != null
                && prediction.getEdition().getLeague().getAdminUser() != null
                && prediction.getEdition().getLeague().getAdminUser().getGoogleEmail() != null
                && prediction.getEdition().getLeague().getAdminUser().getGoogleEmail().equalsIgnoreCase(requesterEmail)) {
            return;
        }

        throw new SecurityException("Solo el administrador del grupo puede marcar el pronostico como pagado.");
    }

    private void saveBackup(Prediction prediction, String action) {
        if (prediction == null) return;

        PredictionBackup backup = PredictionBackup.builder()
                .originalBetId(prediction.getId())
                .participantName(prediction.getParticipantName())
                .betName(prediction.getBetName())
                .paid(prediction.getPaid())
                .action(action)
                .backupTimestamp(LocalDateTime.now())
                .build();

        predictionBackupRepository.save(backup);
    }

    public void createOneTimeSnapshot() {
        predictionRepository.findAll().forEach(prediction -> {
            if (predictionBackupRepository.findByOriginalBetIdOrderByBackupTimestampDesc(prediction.getId()).isEmpty()) {
                saveBackup(prediction, "SNAPSHOT");
            }
        });
    }

    @Transactional(readOnly = true)
    public List<Prediction> getAllPredictions() {
        return predictionRepository.findAllByOrderByCreatedAtDesc();
    }

    @Transactional(readOnly = true)
    public List<Prediction> getAllBets() {
        return getAllPredictions();
    }

    @Transactional(readOnly = true)
    public List<Prediction> getPredictionsByGroupId(Long groupId) {
        return predictionRepository.findByEditionLeagueId(groupId);
    }

    @Transactional(readOnly = true)
    public List<Prediction> getBetsByGroupId(Long groupId) {
        return getPredictionsByGroupId(groupId);
    }

    @Transactional(readOnly = true)
    public List<Prediction> getPredictionsByGoogleEmail(String email) {
        return predictionRepository.findByUserGoogleEmail(email);
    }

    @Transactional(readOnly = true)
    public List<Prediction> getBetsByGoogleEmail(String email) {
        return getPredictionsByGoogleEmail(email);
    }

    @Transactional(readOnly = true)
    public List<Prediction> getPaidPredictions() {
        return predictionRepository.findByPaymentStatus("PAID");
    }

    @Transactional(readOnly = true)
    public List<Prediction> getPaidBets() {
        return getPaidPredictions();
    }

    @Transactional(readOnly = true)
    public Optional<Prediction> findById(Long id) {
        return predictionRepository.findById(id);
    }

    @CacheEvict(value = {"leaderboard", "userGroups", "allBetsDto", "myBetsDto", "rebuiltBetData"}, allEntries = true)
    public Prediction createPrediction(String email, String predictionName, BetDataDTO betData, Long groupId) {
        if (groupId != null) {
            predictionRepository.findByUserGoogleEmailAndEditionLeagueId(email, groupId)
                    .ifPresent(predictionRepository::delete);
        }

        UserAccount user = userAccountRepository.findByGoogleEmail(email).orElse(null);
        Edition edition = groupId != null ? editionRepository.findByLeagueIdAndStatus(groupId, "ACTIVE").orElse(null) : null;

        if (edition != null && edition.isLocked() && !isSuperAdmin(email)) {
            throw new IllegalStateException("El plazo para enviar o modificar pronosticos en esta porra ha finalizado.");
        }

        boolean isOfficial = "official".equalsIgnoreCase(predictionName) || "Admin".equalsIgnoreCase(email);

        Prediction prediction = predictionRepository.save(Prediction.builder()
                .user(user)
                .edition(edition)
                .name(predictionName)
                .isOfficial(isOfficial)
                .paymentStatus("PENDING")
                .createdAt(LocalDateTime.now())
                .build());

        predictionPersistenceService.saveRelationalPredictions(prediction, betData);

        if (groupId != null && user != null && edition != null && edition.getLeague() != null) {
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

        return prediction;
    }

    @CacheEvict(value = {"leaderboard", "userGroups", "allBetsDto", "myBetsDto", "rebuiltBetData"}, allEntries = true)
    public Prediction createBet(String email, String betName, BetDataDTO betData, Long groupId) {
        return createPrediction(email, betName, betData, groupId);
    }

    @CacheEvict(value = {"leaderboard", "userGroups", "allBetsDto", "myBetsDto", "rebuiltBetData"}, allEntries = true)
    public Prediction updatePrediction(Long id, String requesterEmail, String participantName, String predictionName, BetDataDTO betData) {
        Prediction prediction = predictionRepository.findById(id).orElseThrow(() -> new NoSuchElementException("Pronostico no encontrado: " + id));

        verifyPredictionOwnershipOrAdmin(prediction, requesterEmail);

        if (prediction.getEdition() != null && prediction.getEdition().isLocked() && !isSuperAdmin(requesterEmail)) {
            throw new IllegalStateException("El plazo para enviar o modificar pronosticos en esta porra ha finalizado.");
        }

        if (participantName != null) prediction.setParticipantName(participantName);
        if (predictionName != null) prediction.setName(predictionName);

        prediction = predictionRepository.save(prediction);
        if (betData != null) predictionPersistenceService.saveRelationalPredictions(prediction, betData);

        return prediction;
    }

    public Prediction updateBet(Long id, String requesterEmail, String participantName, String betName, BetDataDTO betData) {
        return updatePrediction(id, requesterEmail, participantName, betName, betData);
    }

    public Prediction updateBet(Long id, String participantName, String betName, BetDataDTO betData) {
        return updatePrediction(id, null, participantName, betName, betData);
    }

    @CacheEvict(value = {"leaderboard", "userGroups", "allBetsDto", "myBetsDto", "rebuiltBetData"}, allEntries = true)
    public Prediction markAsPaid(Long id, String requesterEmail) {
        Prediction prediction = predictionRepository.findById(id).orElseThrow(() -> new NoSuchElementException("Pronostico no encontrado: " + id));

        verifyGroupAdminForPayment(prediction, requesterEmail);

        prediction.setPaid(true);

        if (requesterEmail != null) {
            userAccountRepository.findByGoogleEmail(requesterEmail).ifPresent(prediction::setPaymentMarkedBy);
        }

        return predictionRepository.save(prediction);
    }

    public Prediction markAsPaid(Long id) {
        return markAsPaid(id, null);
    }

    @CacheEvict(value = {"leaderboard", "userGroups", "allBetsDto", "myBetsDto", "rebuiltBetData"}, allEntries = true)
    public void deletePrediction(Long id, String requesterEmail) {
        Prediction prediction = predictionRepository.findById(id).orElseThrow(() -> new NoSuchElementException("Pronostico no encontrado: " + id));

        verifyPredictionOwnershipOrAdmin(prediction, requesterEmail);

        predictionRepository.delete(prediction);
    }

    public void deleteBet(Long id, String requesterEmail) {
        deletePrediction(id, requesterEmail);
    }

    public void deleteBet(Long id) {
        deletePrediction(id, null);
    }

    @CacheEvict(value = {"leaderboard", "userGroups", "allBetsDto", "myBetsDto", "rebuiltBetData"}, allEntries = true)
    public Prediction restorePrediction(Long backupId) {
        PredictionBackup backup = predictionBackupRepository.findById(backupId)
                .orElseThrow(() -> new NoSuchElementException("Backup no encontrado: " + backupId));

        Prediction prediction = predictionRepository.findById(backup.getOriginalBetId()).orElseGet(Prediction::new);
        prediction.setId(backup.getOriginalBetId());
        prediction.setParticipantName(backup.getParticipantName());
        prediction.setName(backup.getBetName());
        prediction.setPaid(backup.getPaid());

        prediction = predictionRepository.save(prediction);
        saveBackup(prediction, "RESTORED_FROM_" + backupId);

        return prediction;
    }

    public Prediction restoreBet(Long backupId) {
        return restorePrediction(backupId);
    }

    public List<BetResponseDTO> toBetDtoList(List<Prediction> predictions) {
        return toBetDtoList(predictions, null);
    }

    public List<BetResponseDTO> toBetDtoList(List<Prediction> predictions, String requesterEmail) {
        return predictions.stream().map(pred -> {
            boolean isOwner = requesterEmail != null && pred.getUser() != null && requesterEmail.equalsIgnoreCase(pred.getUser().getGoogleEmail());
            boolean isSuper = isSuperAdmin(requesterEmail);
            boolean isOfficial = pred.isOfficial();
            boolean isLocked = pred.getEdition() != null && pred.getEdition().isLocked();
            boolean canViewDetails = isLocked || isOwner || isSuper || isOfficial;

            BetDataDTO dataDto = null;
            if (canViewDetails) {
                try {
                    dataDto = getBetData(pred.getId());
                } catch (Exception e) {
                    log.warn("Failed to retrieve bet data for prediction ID {}: {}", pred.getId(), e.getMessage());
                }
            }

            return BetResponseDTO.builder()
                    .key(pred.getId().toString())
                    .hash(pred.getId().toString())
                    .paid(pred.getPaid())
                    .participantName(pred.getParticipantName())
                    .userId(pred.getUser() != null ? pred.getUser().getId() : null)
                    .betName(pred.getBetName())
                    .groupId(pred.getGroupId())
                    .data(dataDto)
                    .build();
        }).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public BetDataDTO getBetData(Long id, String requesterEmail) {
        Prediction pred = predictionRepository.findById(id).orElseThrow(() -> new NoSuchElementException("Prediction not found: " + id));
        boolean isOwner = requesterEmail != null && pred.getUser() != null && requesterEmail.equalsIgnoreCase(pred.getUser().getGoogleEmail());
        boolean isSuper = isSuperAdmin(requesterEmail);
        boolean isOfficial = pred.isOfficial();
        boolean isLocked = pred.getEdition() != null && pred.getEdition().isLocked();

        if (!isLocked && !isOwner && !isSuper && !isOfficial) {
            throw new SecurityException("Los pronosticos de otros participantes estaran ocultos hasta que finalice el plazo de inscripcion.");
        }

        return getBetData(id);
    }

    @Transactional(readOnly = true)
    public BetDataDTO getBetData(Long id) {
        Prediction pred = predictionRepository.findById(id).orElseThrow(() -> new NoSuchElementException("Prediction not found"));
        BetDataDTO dto = predictionPersistenceService.rebuildBetDataDtoFromTables(id);
        dto.setUser(pred.getParticipantName());
        dto.setBet(pred.getBetName());
        return dto;
    }
}
