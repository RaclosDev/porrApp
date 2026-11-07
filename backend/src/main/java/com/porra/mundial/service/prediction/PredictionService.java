package com.porra.mundial.service.prediction;

import com.porra.mundial.exception.BusinessException;
import com.porra.mundial.model.League;
import com.porra.mundial.dto.PredictionDataDTO;
import com.porra.mundial.dto.PredictionResponseDTO;
import com.porra.mundial.model.Edition;
import com.porra.mundial.model.Membership;
import com.porra.mundial.model.Prediction;
import com.porra.mundial.model.PredictionLockMode;
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

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/** Guarda y sirve el árbol del cuadro como un único documento estructurado. */
@Slf4j
@Service
@Transactional
@RequiredArgsConstructor
public class PredictionService {

    private final PredictionRepository predictionRepository;
    private final UserAccountRepository userAccountRepository;
    private final EditionRepository editionRepository;
    private final MembershipRepository membershipRepository;
    private final BracketPredictionValidator bracketValidator;
    private final CustomBracketPredictionValidator customBracketValidator;
    private final CustomLockService customLockService;

    @Transactional(readOnly = true)
    public List<Prediction> getPredictionsByGroupId(Long groupId) {
        return predictionRepository.findByEditionLeagueIdWithUserAndEdition(groupId);
    }

    @Transactional(readOnly = true)
    public List<Prediction> getPredictionsByGoogleEmail(String email) {
        return predictionRepository.findByUserGoogleEmailWithUserAndEdition(email);
    }

    @Transactional(readOnly = true)
    public Optional<Prediction> findById(Long id) {
        return predictionRepository.findById(id);
    }

    // Solo cambia la clasificación de esa liga; la lista de ligas no depende de las predicciones.
    @CacheEvict(value = "leaderboard", key = "#groupId")
    public Prediction createPrediction(String email, String predictionName, PredictionDataDTO predictionData, Long groupId) {
        UserAccount user = userAccountRepository.findByGoogleEmail(email)
                .orElseThrow(() -> BusinessException.notFound("Usuario no encontrado"));
        if (groupId == null) {
            throw BusinessException.badRequest("Falta la liga");
        }
        Edition edition = editionRepository.findByLeagueIdAndStatus(groupId, "ACTIVE")
                .orElseThrow(() -> BusinessException.notFound("No hay una edición activa para esta liga"));

        if (edition.isLocked()) {
            throw BusinessException.conflict("El plazo para enviar o modificar predicciones en esta porra ha finalizado.");
        }

        if (edition.getLeague() != null) {
            Membership.MembershipId memId = new Membership.MembershipId(user.getId(), groupId);
            boolean publicLeague = edition.getLeague().isPublicLeague();
            if (!membershipRepository.existsById(memId) && !publicLeague) {
                throw BusinessException.forbidden("No perteneces a esta liga privada. Debes unirte primero con un código de invitación válido.");
            }
        }

        validateBracket(edition, predictionData);

        Optional<Prediction> existing = predictionRepository.findByUserGoogleEmailAndEditionLeagueId(email, groupId);
        if (progressiveCustom(edition)) {
            CustomLockService.LockState state = customLockService.state(edition);
            if (state.fullyLocked()) {
                throw BusinessException.conflict("El plazo para enviar o modificar predicciones en esta porra ha finalizado.");
            }
            // En unas eliminatorias sorteadas ronda a ronda se puede entrar tarde: solo se pierde lo ya cerrado.
            if (existing.isEmpty() && state.anyLocked() && !DrawnKnockout.applies(edition)) {
                throw BusinessException.conflict("La competición ya ha empezado: no se admiten predicciones nuevas.");
            }
            existing.ifPresent(saved -> customLockService.requireLockedPartsUnchanged(state, saved.getBracketData(), predictionData));
        }
        if (existing.isPresent()) {
            Prediction prediction = existing.get();
            requireSameTopology(prediction.getBracketData(), predictionData);
            prediction.setName(predictionName);
            prediction.setBracketData(predictionData);
            prediction.setScoreCalculatedAt(null);
            return predictionRepository.save(prediction);
        }

        String paymentStatus = "PENDING";
        if (groupId != null) {
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
                .bracketData(predictionData)
                .paymentStatus(paymentStatus)
                .createdAt(Instant.now())
                .build();

        return predictionRepository.save(prediction);
    }

    /** Competición personalizada de cuadro cuyo cierre llega por partes. */
    private static boolean progressiveCustom(Edition edition) {
        return PredictableBracket.applies(edition) && (DrawnKnockout.applies(edition)
                || edition.getLockMode() != null && edition.getLockMode().progressive());
    }

    private void validateBracket(Edition edition, PredictionDataDTO data) {
        if (edition.getCompetition() != null && edition.getCompetition().hasOwnBracket()
                && !com.porra.mundial.model.PoolFormat.isMatchBased(edition.getPoolFormat())) {
            customBracketValidator.validate(edition, data);
        } else if (edition.getCompetition() != null && edition.getCompetition().getOwnerLeague() != null) {
            PredictionLockMode mode = edition.getLockMode() == null ? PredictionLockMode.FIXED_DATE : edition.getLockMode();
            if (!mode.progressive() && edition.getLockDate() == null) {
                throw BusinessException.badRequest(mode == PredictionLockMode.FIRST_MATCH
                        ? "El cierre llegará con el primer partido: el administrador debe ponerle fecha"
                        : "El administrador debe fijar el cierre de predicciones");
            }
            customBracketValidator.validate(edition, data);
        } else {
            bracketValidator.validate(edition, data);
        }
    }

    @Transactional(readOnly = true)
    public List<PredictionResponseDTO> toPredictionDtoList(List<Prediction> predictions, String requesterEmail) {
        if (predictions == null) {
            return java.util.Collections.emptyList();
        }
        Map<Long, CustomLockService.LockState> lockStates = new java.util.HashMap<>();
        return predictions.stream().map(pred -> {
            boolean isOwner = requesterEmail != null && pred.getUser() != null && requesterEmail.equalsIgnoreCase(pred.getUser().getGoogleEmail());
            CustomLockService.LockState partial = !isOwner && progressiveCustom(pred.getEdition())
                    ? lockStates.computeIfAbsent(pred.getEdition().getId(), id -> customLockService.state(pred.getEdition()))
                    : null;
            boolean isLocked = pred.getEdition() != null && pred.getEdition().isLocked()
                    || partial != null && partial.anyLocked();
            boolean canViewDetails = isLocked || isOwner;

            PredictionDataDTO dataDto = null;
            if (canViewDetails) {
                // El conversor ya devuelve null si el JSON guardado no se puede leer.
                dataDto = pred.getBracketData();
                if (dataDto != null && partial != null && !partial.fullyLocked()) {
                    dataDto = customLockService.lockedPartsOnly(partial, dataDto);
                }
                if (dataDto != null) {
                    ensureKnockoutFinals(dataDto);
                    dataDto.setUser(com.porra.mundial.util.TextSanitizer.fixParticipantName(pred.getParticipantName()));
                    dataDto.setPrediction(pred.getPredictionName());
                }
            }

            Long effectiveGroupId = pred.getGroupId();

            return PredictionResponseDTO.builder()
                    .key(pred.getId() != null ? pred.getId().toString() : "")
                    .hash(pred.getId() != null ? pred.getId().toString() : "")
                    .paid(pred.getPaid())
                    .participantName(com.porra.mundial.util.TextSanitizer.fixParticipantName(pred.getParticipantName()))
                    .userId(pred.getUser() != null ? pred.getUser().getId() : null)
                    .predictionName(pred.getPredictionName())
                    .groupId(effectiveGroupId)
                    .data(dataDto)
                    .build();
        }).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public PredictionDataDTO getPredictionData(Long id, String requesterEmail) {
        Prediction pred = predictionRepository.findById(id).orElseThrow(() -> BusinessException.notFound("Predicción no encontrada"));
        boolean isOwner = requesterEmail != null && pred.getUser() != null && requesterEmail.equalsIgnoreCase(pred.getUser().getGoogleEmail());

        if (!isOwner) {
            assertMemberOfPredictionLeague(pred, requesterEmail);
        }

        boolean isLocked = pred.getEdition() != null && pred.getEdition().isLocked();
        CustomLockService.LockState partial = !isOwner && progressiveCustom(pred.getEdition())
                ? customLockService.state(pred.getEdition()) : null;

        if (!isLocked && !isOwner && (partial == null || !partial.anyLocked())) {
            throw BusinessException.forbidden("Las predicciones de otros participantes estarán ocultas hasta que finalice el plazo de inscripción.");
        }

        PredictionDataDTO data = getPredictionData(id);
        return data != null && partial != null && !partial.fullyLocked() ? customLockService.lockedPartsOnly(partial, data) : data;
    }

    /** Los pronósticos de una liga privada solo los ven sus miembros; los de una pública, todos. */
    private void assertMemberOfPredictionLeague(Prediction pred, String requesterEmail) {
        League league = pred.getEdition() != null ? pred.getEdition().getLeague() : null;
        if (league == null || league.isPublicLeague()) {
            return;
        }
        boolean member = requesterEmail != null && !requesterEmail.isBlank()
                && userAccountRepository.findByGoogleEmail(requesterEmail)
                        .map(user -> membershipRepository.existsById(new Membership.MembershipId(user.getId(), league.getId())))
                        .orElse(false);
        if (!member) {
            throw BusinessException.forbidden("No perteneces a esta liga privada");
        }
    }

    @Transactional(readOnly = true)
    public PredictionDataDTO getPredictionData(Long id) {
        Prediction pred = predictionRepository.findById(id).orElseThrow(() -> BusinessException.notFound("Predicción no encontrada"));
        PredictionDataDTO dto = pred.getBracketData();
        if (dto == null) {
            dto = new PredictionDataDTO();
        }
        ensureKnockoutFinals(dto);
        dto.setUser(com.porra.mundial.util.TextSanitizer.fixParticipantName(pred.getParticipantName()));
        dto.setPrediction(pred.getPredictionName());
        return dto;
    }

    private void requireSameTopology(PredictionDataDTO stored, PredictionDataDTO incoming) {
        if (stored == null) return;
        int previous = stored.getTopologyVersion() == null ? 1 : stored.getTopologyVersion();
        int next = incoming.getTopologyVersion() == null ? 1 : incoming.getTopologyVersion();
        if (previous != next)
            throw BusinessException.badRequest("La versión del cuadro guardado no puede cambiar al editarlo");
    }

    public void ensureKnockoutFinals(PredictionDataDTO dto) {
        if (dto == null || Integer.valueOf(2).equals(dto.getTopologyVersion())) return;
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
}
