package com.porra.mundial.service;

import com.porra.mundial.dto.PredictionDataDTO;
import com.porra.mundial.dto.PredictionResponseDTO;
import com.porra.mundial.model.Edition;
import com.porra.mundial.model.Membership;
import com.porra.mundial.model.Prediction;
import com.porra.mundial.model.UserAccount;
import com.porra.mundial.repository.EditionRepository;
import com.porra.mundial.repository.MembershipRepository;
import com.porra.mundial.repository.PredictionRepository;
import com.porra.mundial.repository.UserAccountRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Servicio principal de gestión de pronósticos (Prediction).
 * Almacena y sirve el árbol del cuadro directamente como documento estructurado.
 */
@Slf4j
@Service
@Transactional
@RequiredArgsConstructor
public class PredictionService {

    private final PredictionRepository predictionRepository;
    private final UserAccountRepository userAccountRepository;
    private final EditionRepository editionRepository;
    private final MembershipRepository membershipRepository;

    public void verifyPredictionOwnershipOrAdmin(Prediction prediction, String requesterEmail) {
        if (requesterEmail == null || requesterEmail.isBlank()) {
            throw new SecurityException("Usuario no autenticado");
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

        if (prediction.getEdition() != null && prediction.getEdition().getLeague() != null
                && prediction.getEdition().getLeague().getAdminUser() != null
                && prediction.getEdition().getLeague().getAdminUser().getGoogleEmail() != null
                && prediction.getEdition().getLeague().getAdminUser().getGoogleEmail().equalsIgnoreCase(requesterEmail)) {
            return;
        }

        throw new SecurityException("Solo el administrador del grupo puede marcar el pronostico como pagado.");
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
        return predictionRepository.findByEditionLeagueIdWithUserAndEdition(groupId);
    }

    @Transactional(readOnly = true)
    public List<Prediction> getBetsByGroupId(Long groupId) {
        return getPredictionsByGroupId(groupId);
    }

    @Transactional(readOnly = true)
    public List<Prediction> getPredictionsByGoogleEmail(String email) {
        return predictionRepository.findByUserGoogleEmailWithUserAndEdition(email);
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

    @CacheEvict(value = {"leaderboard", "userGroups", "allBetsDto", "allPredictionsDto", "myBetsDto", "myPredictionsDto", "rebuiltBetData", "rebuiltPredictionData"}, allEntries = true)
    public Prediction createPrediction(String email, String predictionName, PredictionDataDTO betData, Long groupId) {
        UserAccount user = userAccountRepository.findByGoogleEmail(email).orElse(null);
        Long effectiveGroupId = groupId != null ? groupId : 1L;
        Edition edition = editionRepository.findByLeagueIdAndStatus(effectiveGroupId, "ACTIVE")
                .or(() -> editionRepository.findByLeagueIdAndStatus(1L, "ACTIVE"))
                .orElse(null);

        if (edition != null && edition.isLocked()) {
            throw new IllegalStateException("El plazo para enviar o modificar pronosticos en esta porra ha finalizado.");
        }

        if (groupId != null && user != null && edition != null && edition.getLeague() != null) {
            Membership.MembershipId memId = new Membership.MembershipId(user.getId(), groupId);
            boolean isGlobal = "GLOBAL".equalsIgnoreCase(edition.getLeague().getJoinCode());
            if (!membershipRepository.existsById(memId) && !isGlobal) {
                throw new SecurityException("No perteneces a esta liga privada. Debes unirte primero con un código de invitación válido.");
            }
        }

        if (groupId != null) {
            predictionRepository.findByUserGoogleEmailAndEditionLeagueId(email, groupId)
                    .ifPresent(predictionRepository::delete);
        }

        boolean isOfficial = "official".equalsIgnoreCase(predictionName) || "Admin".equalsIgnoreCase(email);

        String paymentStatus = "PENDING";
        if (groupId != null && user != null) {
            Membership.MembershipId memberId = new Membership.MembershipId(user.getId(), groupId);
            paymentStatus = membershipRepository.findById(memberId)
                    .map(Membership::getPaymentStatus)
                    .filter(status -> status != null && !status.isBlank())
                    .orElse("PENDING");
        }

        Prediction prediction = Prediction.builder()
                .user(user)
                .edition(edition)
                .name(predictionName)
                .isOfficial(isOfficial)
                .bracketData(betData)
                .paymentStatus(paymentStatus)
                .createdAt(LocalDateTime.now())
                .build();

        return predictionRepository.save(prediction);
    }

    @CacheEvict(value = {"leaderboard", "userGroups", "allBetsDto", "allPredictionsDto", "myBetsDto", "myPredictionsDto", "rebuiltBetData", "rebuiltPredictionData"}, allEntries = true)
    public Prediction createBet(String email, String betName, PredictionDataDTO betData, Long groupId) {
        return createPrediction(email, betName, betData, groupId);
    }

    @CacheEvict(value = {"leaderboard", "userGroups", "allBetsDto", "allPredictionsDto", "myBetsDto", "myPredictionsDto", "rebuiltBetData", "rebuiltPredictionData"}, allEntries = true)
    public Prediction updatePrediction(Long id, String requesterEmail, String participantName, String predictionName, PredictionDataDTO betData) {
        Prediction prediction = predictionRepository.findById(id).orElseThrow(() -> new NoSuchElementException("Pronostico no encontrado: " + id));

        verifyPredictionOwnershipOrAdmin(prediction, requesterEmail);

        if (prediction.getEdition() != null && prediction.getEdition().isLocked()) {
            throw new IllegalStateException("El plazo para enviar o modificar pronosticos en esta porra ha finalizado.");
        }

        if (participantName != null) prediction.setParticipantName(participantName);
        if (predictionName != null) prediction.setName(predictionName);
        if (betData != null) prediction.setBracketData(betData);

        return predictionRepository.save(prediction);
    }

    public Prediction updateBet(Long id, String requesterEmail, String participantName, String betName, PredictionDataDTO betData) {
        return updatePrediction(id, requesterEmail, participantName, betName, betData);
    }

    public Prediction updateBet(Long id, String participantName, String betName, PredictionDataDTO betData) {
        return updatePrediction(id, null, participantName, betName, betData);
    }

    @CacheEvict(value = {"leaderboard", "userGroups", "allBetsDto", "allPredictionsDto", "myBetsDto", "myPredictionsDto", "rebuiltBetData", "rebuiltPredictionData"}, allEntries = true)
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

    @CacheEvict(value = {"leaderboard", "userGroups", "allBetsDto", "allPredictionsDto", "myBetsDto", "myPredictionsDto", "rebuiltBetData", "rebuiltPredictionData"}, allEntries = true)
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

    public List<PredictionResponseDTO> toBetDtoList(List<Prediction> predictions, String requesterEmail) {
        return toPredictionDtoList(predictions, requesterEmail);
    }

    @Transactional(readOnly = true)
    public List<PredictionResponseDTO> toPredictionDtoList(List<Prediction> predictions, String requesterEmail) {
        if (predictions == null) {
            return java.util.Collections.emptyList();
        }
        return predictions.stream().map(pred -> {
            boolean isOwner = requesterEmail != null && pred.getUser() != null && requesterEmail.equalsIgnoreCase(pred.getUser().getGoogleEmail());
            boolean isOfficial = pred.isOfficial();
            boolean isLocked = pred.getEdition() != null && pred.getEdition().isLocked();
            boolean canViewDetails = isLocked || isOwner || isOfficial;

            PredictionDataDTO dataDto = null;
            if (canViewDetails) {
                try {
                    dataDto = pred.getBracketData();
                } catch (Exception e) {
                    log.warn("Error leyendo bracket_data para predicción {}: {}", pred.getId(), e.getMessage());
                }
                if (dataDto != null) {
                    ensureKnockoutFinals(dataDto);
                    dataDto.setUser(com.porra.mundial.util.TextSanitizer.fixParticipantName(pred.getParticipantName()));
                    dataDto.setPrediction(pred.getBetName());
                }
            }

            Long effectiveGroupId = null;
            try {
                effectiveGroupId = pred.getGroupId();
            } catch (Exception e) {
                log.warn("Error resolviendo groupId para predicción {}: {}", pred.getId(), e.getMessage());
            }

            return PredictionResponseDTO.builder()
                    .key(pred.getId() != null ? pred.getId().toString() : "")
                    .hash(pred.getId() != null ? pred.getId().toString() : "")
                    .paid(pred.getPaid())
                    .participantName(com.porra.mundial.util.TextSanitizer.fixParticipantName(pred.getParticipantName()))
                    .userId(pred.getUser() != null ? pred.getUser().getId() : null)
                    .predictionName(pred.getBetName())
                    .groupId(effectiveGroupId)
                    .data(dataDto)
                    .build();
        }).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public PredictionDataDTO getPredictionData(Long id, String requesterEmail) {
        Prediction pred = predictionRepository.findById(id).orElseThrow(() -> new NoSuchElementException("Prediction not found: " + id));
        boolean isOwner = requesterEmail != null && pred.getUser() != null && requesterEmail.equalsIgnoreCase(pred.getUser().getGoogleEmail());
        
        boolean isOfficial = pred.isOfficial();
        boolean isLocked = pred.getEdition() != null && pred.getEdition().isLocked();

        if (!isLocked && !isOwner && !isOfficial) {
            throw new SecurityException("Los pronosticos de otros participantes estaran ocultos hasta que finalice el plazo de inscripcion.");
        }

        return getPredictionData(id);
    }

    @Transactional(readOnly = true)
    public PredictionDataDTO getBetData(Long id, String requesterEmail) {
        return getPredictionData(id, requesterEmail);
    }

    @Transactional(readOnly = true)
    public PredictionDataDTO getPredictionData(Long id) {
        Prediction pred = predictionRepository.findById(id).orElseThrow(() -> new NoSuchElementException("Prediction not found: " + id));
        PredictionDataDTO dto = pred.getBracketData();
        if (dto == null) {
            dto = new PredictionDataDTO();
        }
        ensureKnockoutFinals(dto);
        dto.setUser(com.porra.mundial.util.TextSanitizer.fixParticipantName(pred.getParticipantName()));
        dto.setPrediction(pred.getBetName());
        return dto;
    }

    public void ensureKnockoutFinals(PredictionDataDTO dto) {
        if (dto == null) return;
        if ((dto.getFinalMatch() == null || dto.getFinalMatch().isEmpty()) && dto.getSf() != null && dto.getSf().size() >= 2 && dto.getChampion() != null) {
            List<String> sf1 = dto.getSf().get(0);
            List<String> sf2 = dto.getSf().get(1);
            if (sf1 != null && sf2 != null) {
                String champ = dto.getChampion();
                boolean inSf1 = sf1.contains(champ);
                boolean inSf2 = sf2.contains(champ);
                String finalist1 = inSf1 ? champ : null;
                String finalist2 = inSf2 ? champ : null;
                List<String> thirds = dto.getThirdPlaceMatch() != null ? dto.getThirdPlaceMatch() : java.util.Collections.emptyList();
                if (inSf1) {
                    finalist2 = sf2.stream().filter(t -> !thirds.contains(t)).findFirst().orElse(!sf2.isEmpty() ? sf2.get(0) : null);
                } else if (inSf2) {
                    finalist1 = sf1.stream().filter(t -> !thirds.contains(t)).findFirst().orElse(!sf1.isEmpty() ? sf1.get(0) : null);
                }
                if (finalist1 != null && finalist2 != null) {
                    dto.setFinalMatch(List.of(finalist1, finalist2));
                }
            }
        }
        if ((dto.getThirdPlaceMatch() == null || dto.getThirdPlaceMatch().isEmpty()) && dto.getSf() != null && dto.getSf().size() >= 2 && dto.getFinalMatch() != null && dto.getFinalMatch().size() >= 2) {
            List<String> sf1 = dto.getSf().get(0);
            List<String> sf2 = dto.getSf().get(1);
            if (sf1 != null && sf2 != null) {
                List<String> f = dto.getFinalMatch();
                String t1 = sf1.stream().filter(t -> !f.contains(t)).findFirst().orElse(null);
                String t2 = sf2.stream().filter(t -> !f.contains(t)).findFirst().orElse(null);
                if (t1 != null && t2 != null) {
                    dto.setThirdPlaceMatch(List.of(t1, t2));
                }
            }
        }
    }

    @Transactional(readOnly = true)
    public PredictionDataDTO getBetData(Long id) {
        return getPredictionData(id);
    }
}
