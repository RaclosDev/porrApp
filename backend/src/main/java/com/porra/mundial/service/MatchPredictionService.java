package com.porra.mundial.service;

import com.porra.mundial.exception.BusinessException;
import com.porra.mundial.dto.MatchPredictionItemDTO;
import com.porra.mundial.dto.MatchdayFixturePredictionDTO;
import com.porra.mundial.dto.MatchdayFriendPredictionDTO;
import com.porra.mundial.model.*;
import com.porra.mundial.repository.*;
import com.porra.mundial.scoring.MatchScoreResult;
import com.porra.mundial.scoring.MatchScoringCalculator;
import com.porra.mundial.scoring.ScoringRuleSet;
import com.porra.mundial.util.MatchRound;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

/** Pronósticos por partido (1X2 y marcador), con cierre al empezar cada partido. */
@Slf4j
@Service
@RequiredArgsConstructor
public class MatchPredictionService {

    private final MatchRepository matchRepository;
    private final MatchPredictionRepository matchPredictionRepository;
    private final PredictionRepository predictionRepository;
    private final UserAccountRepository userAccountRepository;
    private final EditionRepository editionRepository;
    private final MembershipRepository membershipRepository;
    private final MatchScoringCalculator matchScoringCalculator;
    private final ScoreInvalidationService scoreInvalidationService;

    /**
     * Devuelve los partidos del calendario junto con los pronósticos del usuario y su estado de bloqueo.
     */
    @Transactional(readOnly = true)
    public List<MatchdayFixturePredictionDTO> getMatchdayFixtures(String email, Long groupId, String round) {
        Edition edition = groupId != null
                ? editionRepository.findByLeagueIdAndStatus(groupId, "ACTIVE").orElse(null)
                : null;
        if (groupId != null) {
            // Misma regla que al guardar: en una liga pública cualquiera puede pronosticar, así que
            // también ve sus partidos; en una privada, solo los miembros.
            boolean publicLeague = edition != null && edition.getLeague() != null && edition.getLeague().isPublicLeague();
            boolean isMember = false;
            if (!publicLeague && email != null && !email.isBlank()) {
                UserAccount user = userAccountRepository.findByGoogleEmail(email)
                        .orElse(null);
                if (user != null) {
                    Membership.MembershipId memId = new Membership.MembershipId(user.getId(), groupId);
                    isMember = membershipRepository.existsById(memId);
                }
            }
            if (!publicLeague && !isMember) {
                throw BusinessException.forbidden("No perteneces a esta liga privada.");
            }
        }

        if (edition == null || edition.getPoolFormat() == null || edition.getPoolFormat() != PoolFormat.MATCH_DAY) {
            return java.util.Collections.emptyList();
        }

        if (edition.getCompetition() == null) {
            throw BusinessException.conflict("La liga no tiene una competición configurada.");
        }
        Long competitionId = edition.getCompetition().getId();
        List<Match> matches;
        if (round != null && !round.isBlank()) {
            // La jornada se filtra en SQL; el filtro en Java solo afina lo que la consulta deja pasar.
            final String cleanRound = round.trim();
            MatchRound.Lookup lookup = MatchRound.lookup(cleanRound);
            matches = matchRepository.findRoundCandidates(competitionId, lookup.names(), lookup.dayStart(),
                            lookup.dayEnd(), lookup.undated()).stream()
                    .filter(m -> MatchRound.matches(m, cleanRound))
                    .collect(Collectors.toList());
        } else {
            matches = matchRepository.findByCompetitionIdOrderByMatchDateAsc(competitionId);
        }

        // Excluir partidos fantasma donde ambos equipos son 'Por definir'
        matches = matches.stream()
                .filter(m -> {
                    if (m.getHomeTeam() == null || m.getAwayTeam() == null) return true;
                    boolean h = Team.isPlaceholder(m.getHomeTeam());
                    boolean a = Team.isPlaceholder(m.getAwayTeam());
                    return !(h && a);
                })
                .collect(Collectors.toList());

        Prediction userPrediction = null;
        if (email != null && !email.isBlank() && groupId != null) {
            userPrediction = predictionRepository.findByUserGoogleEmailAndEditionLeagueId(email, groupId).orElse(null);
        }

        Map<Long, MatchPrediction> predictionMap = new HashMap<>();
        if (userPrediction != null && !matches.isEmpty()) {
            // Solo los pronósticos de los partidos que se devuelven, no los de toda la temporada.
            List<Long> matchIds = matches.stream().map(Match::getId).toList();
            List<MatchPrediction> userPredictions =
                    matchPredictionRepository.findByPredictionIdAndMatchIdIn(userPrediction.getId(), matchIds);
            for (MatchPrediction mp : userPredictions) {
                if (mp.getMatch() != null) {
                    predictionMap.put(mp.getMatch().getId(), mp);
                }
            }
        }

        ScoringRuleSet rules = ScoringRuleSet.forEdition(edition);

        Instant now = Instant.now();
        Map<Long, Instant> lockTimes = MatchdayLock.lockTimes(edition, matches,
                MatchdayLock.needsWholeCalendar(edition) ? matchRepository.findByCompetitionId(competitionId) : matches);
        List<MatchdayFixturePredictionDTO> result = new ArrayList<>();

        for (Match match : matches) {
            MatchPrediction mp = predictionMap.get(match.getId());

            boolean isLocked = false;
            String lockReason = "Abierto";

            if (edition != null && edition.isLocked()) {
                isLocked = true;
                lockReason = "La porra ha finalizado su plazo de inscripción general";
            } else if (Boolean.TRUE.equals(match.getFinished())) {
                isLocked = true;
                lockReason = "El partido ya ha finalizado";
            } else if (match.getStatus() != null && !match.getStatus().isOpenForPrediction()) {
                isLocked = true;
                lockReason = "El estado del partido no admite predicciones";
            } else if (lockTimes.containsKey(match.getId()) && !lockTimes.get(match.getId()).isAfter(now)) {
                isLocked = true;
                lockReason = MatchdayLock.reason(edition, match, now);
            }

            Integer pointsAwarded = null;
            Boolean isExact = null;
            Boolean isCorrectSign = null;
            String scoringDetails = null;

            if (mp != null) {
                pointsAwarded = mp.getPointsAwarded();
                isExact = mp.getIsExactScore();
                isCorrectSign = mp.getIsCorrectSign();
                scoringDetails = mp.getScoringDetails();

                // Si el partido está terminado o tiene marcador oficial y no se había evaluado
                if (hasScorableResult(match)
                        && match.getHomeScore() != null && match.getAwayScore() != null) {
                    MatchScoreResult scoreResult = scorePrediction(mp, match, rules);
                    pointsAwarded = scoreResult.totalPoints();
                    isExact = scoreResult.exactScore();
                    isCorrectSign = scoreResult.correctSign();
                    scoringDetails = scoreResult.explanation();
                }
            }

            result.add(MatchdayFixturePredictionDTO.builder()
                    .matchId(match.getId())
                    .homeTeam(match.getHomeTeam() != null ? match.getHomeTeam().getName() : Team.PLACEHOLDER_NAME)
                    .awayTeam(match.getAwayTeam() != null ? match.getAwayTeam().getName() : Team.PLACEHOLDER_NAME)
                    .homeTeamId(match.getHomeTeam() != null ? match.getHomeTeam().getId() : null)
                    .awayTeamId(match.getAwayTeam() != null ? match.getAwayTeam().getId() : null)
                    .homeTeamLogo(match.getHomeTeam() != null ? match.getHomeTeam().getLogoUrl() : null)
                    .awayTeamLogo(match.getAwayTeam() != null ? match.getAwayTeam().getLogoUrl() : null)
                    .matchDate(match.getMatchDate())
                    .round(MatchRound.label(match))
                    .groupName(match.getGroupName())
                    .finished(match.getFinished())
                    .status(match.getStatus() != null ? match.getStatus().name() : null)
                    .actualHomeScore(match.getHomeScore())
                    .actualAwayScore(match.getAwayScore())
                    .displayClock(match.getDisplayClock())
                    .predHomeScore(mp != null ? mp.getHomeScore() : null)
                    .predAwayScore(mp != null ? mp.getAwayScore() : null)
                    .predSign(mp != null ? mp.getPredictionSign() : null)
                    .locked(isLocked)
                    .lockAt(lockTimes.get(match.getId()))
                    .lockReason(lockReason)
                    .pointsAwarded(pointsAwarded)
                    .isExactScore(isExact)
                    .isCorrectSign(isCorrectSign)
                    .scoringDetails(scoringDetails)
                    .build());
        }

        return result;
    }

    /**
     * Guarda o actualiza los pronósticos de una lista de partidos comprobando los plazos individuales.
     */
    @Transactional
    public int saveMatchdayPredictions(String email, Long groupId, List<MatchPredictionItemDTO> items) {
        if (email == null || email.isBlank()) {
            throw BusinessException.forbidden("Usuario no autenticado");
        }
        if (groupId == null) {
            throw BusinessException.badRequest("El identificador de grupo es obligatorio");
        }
        if (items == null || items.isEmpty()) {
            return 0;
        }

        UserAccount user = userAccountRepository.findByGoogleEmail(email)
                .orElseThrow(() -> BusinessException.notFound("Usuario no encontrado"));

        Edition edition = editionRepository.findByLeagueIdAndStatus(groupId, "ACTIVE")
                .orElseThrow(() -> BusinessException.notFound("No se encontró una edición activa para esta liga"));

        if (edition.getPoolFormat() != PoolFormat.MATCH_DAY) {
            throw BusinessException.badRequest("Esta liga no utiliza la modalidad de predicciones por jornadas.");
        }

        if (edition.isLocked()) {
            throw BusinessException.conflict("El plazo general de la porra ha finalizado.");
        }

        Membership.MembershipId memId = new Membership.MembershipId(user.getId(), groupId);
        boolean publicLeague = edition.getLeague() != null && edition.getLeague().isPublicLeague();
        if (!membershipRepository.existsById(memId) && !publicLeague) {
            throw BusinessException.forbidden("No perteneces a esta liga privada. Debes unirte primero con un código de invitación válido.");
        }

        Prediction prediction = predictionRepository.findByUserGoogleEmailAndEditionLeagueId(email, groupId)
                .orElseGet(() -> {
                    String predName = "Pronósticos de " + user.getParticipantName();
                    Membership membership = membershipRepository.findById(memId).orElse(null);
                    String paymentStatus = membership != null && membership.getPaymentStatus() != null
                            ? membership.getPaymentStatus()
                            : "PENDING";
                    // La porra nueva entra en la clasificación. Pronosticar partidos abiertos no cambia
                    // ningún punto, así que el resto de guardados no la invalidan.
                    scoreInvalidationService.evictLeaderboardAfterCommit(groupId);
                    return predictionRepository.save(Prediction.builder()
                            .user(user)
                            .edition(edition)
                            .name(predName)
                            .paymentStatus(paymentStatus)
                            .createdAt(Instant.now())
                            .build());
                });

        

        Instant now = Instant.now();
        List<Match> calendar = MatchdayLock.needsWholeCalendar(edition) && edition.getCompetition() != null
                ? matchRepository.findByCompetitionId(edition.getCompetition().getId()) : null;
        int savedCount = 0;

        // Dos consultas para toda la jornada en vez de dos por partido.
        List<Long> matchIds = items.stream().map(MatchPredictionItemDTO::getMatchId)
                .filter(Objects::nonNull).distinct().toList();
        Map<Long, Match> matchesById = matchRepository.findAllById(matchIds).stream()
                .collect(Collectors.toMap(Match::getId, m -> m));
        Map<Long, MatchPrediction> existingByMatchId = prediction.getId() == null || matchIds.isEmpty()
                ? new HashMap<>()
                : matchPredictionRepository.findByPredictionIdAndMatchIdIn(prediction.getId(), matchIds).stream()
                        .collect(Collectors.toMap(mp -> mp.getMatch().getId(), mp -> mp, (a, b) -> a));

        for (MatchPredictionItemDTO item : items) {
            if (item.getMatchId() == null) continue;

            Match match = matchesById.get(item.getMatchId());
            if (match == null) throw BusinessException.notFound("Partido no encontrado");

            if (edition.getCompetition() == null || match.getCompetition() == null
                    || !Objects.equals(edition.getCompetition().getId(), match.getCompetition().getId())) {
                throw BusinessException.badRequest("El partido no pertenece a la competición de esta liga.");
            }

            if (Boolean.TRUE.equals(match.getFinished())) {
                throw BusinessException.conflict(String.format("El partido %s vs %s ya ha finalizado y no puede modificarse.",
                        match.getHomeTeam() != null ? match.getHomeTeam().getName() : "Local",
                        match.getAwayTeam() != null ? match.getAwayTeam().getName() : "Visitante"));
            }
            if (match.getStatus() != null && !match.getStatus().isOpenForPrediction()) {
                throw BusinessException.conflict("El estado del partido no admite predicciones.");
            }
            Instant lockAt = MatchdayLock.lockTimes(edition, List.of(match),
                    calendar == null ? List.of(match) : calendar).get(match.getId());
            if (lockAt != null && !lockAt.isAfter(now)) {
                throw BusinessException.conflict(String.format("%s: la predicción de %s vs %s está bloqueada.",
                        MatchdayLock.reason(edition, match, now),
                        match.getHomeTeam() != null ? match.getHomeTeam().getName() : "Local",
                        match.getAwayTeam() != null ? match.getAwayTeam().getName() : "Visitante"));
            }

            // Calcular signo automáticamente si no se especifica explícitamente pero hay goles
            String sign = item.getSign();
            if ((item.getHomeScore() == null) != (item.getAwayScore() == null)) {
                throw BusinessException.badRequest("Completa los dos marcadores del partido.");
            }
            if (item.getHomeScore() != null && item.getAwayScore() != null) {
                int cmp = Integer.compare(item.getHomeScore(), item.getAwayScore());
                sign = cmp > 0 ? "1" : (cmp == 0 ? "X" : "2");
            }
            if (!Set.of("1", "X", "2").contains(sign == null ? "" : sign)) {
                throw BusinessException.badRequest("La predicción debe incluir un marcador completo o un signo 1, X o 2.");
            }

            MatchPrediction matchPred = existingByMatchId.computeIfAbsent(match.getId(), id -> MatchPrediction.builder()
                    .prediction(prediction)
                    .match(match)
                    .build());

            matchPred.setHomeScore(item.getHomeScore());
            matchPred.setAwayScore(item.getAwayScore());
            matchPred.setPredictionSign(sign);

            // A provider's pre-match 0-0 is not a result and must not award points.
            matchPred.setPointsAwarded(null);
            matchPred.setIsExactScore(null);
            matchPred.setIsCorrectSign(null);
            matchPred.setScoringDetails(null);

            matchPredictionRepository.save(matchPred);
            savedCount++;
        }

        return savedCount;
    }

    /** Si algún pronóstico del partido sigue sin puntuar. */
    @Transactional(readOnly = true)
    public boolean hasUnscoredPredictions(Long matchId) {
        return matchId != null && matchPredictionRepository.existsByMatchIdAndPointsAwardedIsNull(matchId);
    }

    /** Evalúa o actualiza los puntos provisionales mientras cambia el marcador en directo. */
    @Transactional
    public void evaluatePredictionsForMatch(Match match) {
        if (match == null || !hasScorableResult(match) || match.getId() == null
                || match.getHomeScore() == null || match.getAwayScore() == null) {
            return;
        }

        List<MatchPrediction> predictions = matchPredictionRepository.findByMatchId(match.getId());
        Set<Prediction> affectedPredictions = new HashSet<>();
        for (MatchPrediction mp : predictions) {
            ScoringRuleSet rules = ScoringRuleSet.forEdition(mp.getPrediction() != null ? mp.getPrediction().getEdition() : null);
            applyScore(mp, scorePrediction(mp, match, rules));
            matchPredictionRepository.save(mp);

            if (mp.getPrediction() != null) {
                affectedPredictions.add(mp.getPrediction());
            }
        }

        scoreInvalidationService.evictLeaderboardAfterCommit();
        for (Prediction pred : affectedPredictions) {
            pred.setScoreCalculatedAt(null);
            predictionRepository.save(pred);
        }
    }

    private static boolean hasScorableResult(Match match) {
        return Boolean.TRUE.equals(match.getFinished())
                || match.getStatus() == com.porra.mundial.model.MatchStatusNormalized.LIVE
                || match.getStatus() == com.porra.mundial.model.MatchStatusNormalized.PAUSED;
    }

    /**
     * Vuelve a puntuar los pronósticos de los partidos ya terminados de una edición con sus reglas actuales.
     * Se usa al cambiar la puntuación de la liga; los partidos por jugar siguen sin puntos.
     *
     * @return número de pronósticos puntuados de nuevo
     */
    @Transactional
    public int rescoreEdition(Edition edition) {
        if (edition == null || edition.getId() == null) return 0;
        ScoringRuleSet rules = ScoringRuleSet.forEdition(edition);
        List<MatchPrediction> rescored = new ArrayList<>();
        for (MatchPrediction mp : matchPredictionRepository.findWithMatchByPredictionEditionId(edition.getId())) {
            Match match = mp.getMatch();
            if (match == null || !Boolean.TRUE.equals(match.getFinished())
                    || match.getHomeScore() == null || match.getAwayScore() == null) {
                continue;
            }
            applyScore(mp, scorePrediction(mp, match, rules));
            rescored.add(mp);
        }
        matchPredictionRepository.saveAll(rescored);
        return rescored.size();
    }

    private static void applyScore(MatchPrediction mp, MatchScoreResult result) {
        mp.setPointsAwarded(result.totalPoints());
        mp.setIsExactScore(result.exactScore());
        mp.setIsCorrectSign(result.correctSign());
        mp.setScoringDetails(result.explanation());
    }

    private MatchScoreResult scorePrediction(MatchPrediction prediction, Match match, ScoringRuleSet rules) {
        if (prediction.getHomeScore() == null && prediction.getAwayScore() == null) {
            return matchScoringCalculator.calculateSign(prediction.getPredictionSign(), match.getHomeScore(), match.getAwayScore(), rules);
        }
        return matchScoringCalculator.calculate(prediction.getHomeScore(), prediction.getAwayScore(),
                match.getHomeScore(), match.getAwayScore(), rules);
    }

    /**
     * Devuelve las predicciones de todos los miembros del grupo para un partido específico.
     * Si el partido está abierto, los resultados de otros usuarios permanecen ocultos para evitar copias.
     */
    @Transactional(readOnly = true)
    public List<MatchdayFriendPredictionDTO> getFriendPredictionsForMatch(String email, Long groupId, Long matchId) {
        if (groupId == null || matchId == null) {
            throw BusinessException.badRequest("El grupo y el partido son obligatorios");
        }

        Match match = matchRepository.findById(matchId)
                .orElseThrow(() -> BusinessException.notFound("Partido no encontrado"));

        Edition edition = editionRepository.findByLeagueIdAndStatus(groupId, "ACTIVE").orElse(null);

        UserAccount caller = (email != null && !email.isBlank())
                ? userAccountRepository.findByGoogleEmail(email)
                    .orElse(null)
                : null;

        boolean publicLeague = edition != null && edition.getLeague() != null && edition.getLeague().isPublicLeague();
        if (!publicLeague) {
            boolean isMember = false;
            if (caller != null) {
                    Membership.MembershipId memId = new Membership.MembershipId(caller.getId(), groupId);
                    isMember = membershipRepository.existsById(memId);
                }
            if (!isMember) {
                throw BusinessException.forbidden("No perteneces a esta liga privada.");
            }
        }

        Instant now = Instant.now();
        Instant lockAt = edition == null || edition.getPoolFormat() != PoolFormat.MATCH_DAY
                ? match.getMatchDate()
                : MatchdayLock.lockTimes(edition, List.of(match), MatchdayLock.needsWholeCalendar(edition)
                        && match.getCompetition() != null
                        ? matchRepository.findByCompetitionId(match.getCompetition().getId()) : List.of(match))
                        .get(match.getId());
        boolean isMatchLocked = Boolean.TRUE.equals(match.getFinished())
                || (match.getStatus() != null && !match.getStatus().isOpenForPrediction())
                || (lockAt != null && !lockAt.isAfter(now))
                || (edition != null && edition.isLocked());

        List<Membership> memberships = membershipRepository.findByLeagueId(groupId);
        Map<Long, UserAccount> memberMap = new LinkedHashMap<>();
        for (Membership m : memberships) {
            if (m.getUser() != null) {
                memberMap.put(m.getUser().getId(), m.getUser());
            }
        }

        List<MatchPrediction> matchPreds = matchPredictionRepository.findFriendsByMatchAndLeague(matchId, groupId);

        Map<Long, MatchPrediction> userPredMap = new HashMap<>();
        for (MatchPrediction mp : matchPreds) {
            if (mp.getPrediction().getUser() != null) {
                userPredMap.put(mp.getPrediction().getUser().getId(), mp);
                memberMap.putIfAbsent(mp.getPrediction().getUser().getId(), mp.getPrediction().getUser());
            }
        }

        List<MatchdayFriendPredictionDTO> list = new ArrayList<>();
        for (UserAccount member : memberMap.values()) {
            boolean isCaller = caller != null && caller.getId().equals(member.getId());
            MatchPrediction mp = userPredMap.get(member.getId());

            MatchdayFriendPredictionDTO.MatchdayFriendPredictionDTOBuilder builder = MatchdayFriendPredictionDTO.builder()
                    .userId(member.getId())
                    .participantName(member.getParticipantName() != null ? member.getParticipantName() : "Anónimo")
                    .avatarUrl(member.getAvatarUrl())
                    .caller(isCaller);

            if (mp != null) {
                builder.hasPredicted(true);
                builder.updatedAt(mp.getUpdatedAt() != null ? mp.getUpdatedAt() : mp.getCreatedAt());

                if (isMatchLocked || isCaller) {
                    builder.homeScore(mp.getHomeScore())
                            .awayScore(mp.getAwayScore())
                            .sign(mp.getPredictionSign())
                            .pointsAwarded(mp.getPointsAwarded())
                            .isExactScore(mp.getIsExactScore())
                            .isCorrectSign(mp.getIsCorrectSign())
                            .scoringDetails(mp.getScoringDetails());
                } else {
                    builder.scoringDetails("Predicción oculta hasta el pitido inicial");
                }
            } else {
                builder.hasPredicted(false)
                        .scoringDetails(isMatchLocked ? "Sin predicción (0 pts)" : "Predicción pendiente");
            }

            list.add(builder.build());
        }

        list.sort((a, b) -> {
            if (a.isCaller() != b.isCaller()) return a.isCaller() ? -1 : 1;
            int ptsA = a.getPointsAwarded() != null ? a.getPointsAwarded() : -1;
            int ptsB = b.getPointsAwarded() != null ? b.getPointsAwarded() : -1;
            if (ptsA != ptsB) return Integer.compare(ptsB, ptsA);
            return a.getParticipantName().compareToIgnoreCase(b.getParticipantName());
        });

        return list;
    }
}
