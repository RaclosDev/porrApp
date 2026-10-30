package com.porra.mundial.service;

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
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Servicio de Pronósticos por Jornada y Partido Directo (Matchday).
 * Gestiona el ciclo de vida de los pronósticos 1X2 y marcador exacto,
 * con bloqueo individual por fecha de inicio de partido y cálculo determinista.
 */
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

    /**
     * Devuelve los partidos del calendario junto con los pronósticos del usuario y su estado de bloqueo.
     */
    @Transactional(readOnly = true)
    public List<MatchdayFixturePredictionDTO> getMatchdayFixtures(String email, Long groupId, String round) {
        if (League.isGlobalId(groupId)) {
            return java.util.Collections.emptyList();
        }
        if (groupId != null) {
            boolean isMember = false;
            if (email != null && !email.isBlank()) {
                UserAccount user = userAccountRepository.findByGoogleEmail(email)
                        .or(() -> userAccountRepository.findByParticipantNameIgnoreCase(email))
                        .orElse(null);
                if (user != null) {
                    Membership.MembershipId memId = new Membership.MembershipId(user.getId(), groupId);
                    isMember = membershipRepository.existsById(memId);
                }
            }
            if (!isMember) {
                throw new SecurityException("No perteneces a esta liga privada.");
            }
        }
        Edition edition = groupId != null
                ? editionRepository.findByLeagueIdAndStatus(groupId, "ACTIVE").orElse(null)
                : null;

        if (edition == null || edition.getPoolFormat() == null || edition.getPoolFormat() != PoolFormat.MATCH_DAY) {
            return java.util.Collections.emptyList();
        }

        if (edition.getCompetition() == null) {
            throw new IllegalStateException("La liga no tiene una competición configurada.");
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

        LocalDateTime now = LocalDateTime.now();
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
                lockReason = "El estado del partido no admite pronósticos";
            } else if (match.getMatchDate() != null && !match.getMatchDate().isAfter(now)) {
                isLocked = true;
                lockReason = "El partido ya ha comenzado";
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
                if (Boolean.TRUE.equals(match.getFinished())
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
                    .actualHomeScore(match.getHomeScore())
                    .actualAwayScore(match.getAwayScore())
                    .displayClock(match.getDisplayClock())
                    .predHomeScore(mp != null ? mp.getHomeScore() : null)
                    .predAwayScore(mp != null ? mp.getAwayScore() : null)
                    .predSign(mp != null ? mp.getPredictionSign() : null)
                    .locked(isLocked)
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
    @CacheEvict(value = {"leaderboard", "userGroups"}, allEntries = true)
    public int saveMatchdayPredictions(String email, Long groupId, List<MatchPredictionItemDTO> items) {
        if (email == null || email.isBlank()) {
            throw new SecurityException("Usuario no autenticado");
        }
        if (groupId == null) {
            throw new IllegalArgumentException("El identificador de grupo es obligatorio");
        }
        if (items == null || items.isEmpty()) {
            return 0;
        }

        UserAccount user = userAccountRepository.findByGoogleEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado: " + email));

        Edition edition = editionRepository.findByLeagueIdAndStatus(groupId, "ACTIVE")
                .orElseThrow(() -> new IllegalArgumentException("No se encontró una edición activa para la liga " + groupId));

        if (edition.getPoolFormat() != PoolFormat.MATCH_DAY) {
            throw new IllegalArgumentException("Esta liga no utiliza la modalidad de pronósticos por jornadas.");
        }

        if (edition.isLocked()) {
            throw new IllegalStateException("El plazo general de la porra ha finalizado.");
        }

        // Asegurar membresía previa en ligas privadas
        Membership.MembershipId memId = new Membership.MembershipId(user.getId(), groupId);
        boolean isGlobal = edition.getLeague() != null && edition.getLeague().isGlobal();
        if (!membershipRepository.existsById(memId) && !isGlobal) {
            throw new SecurityException("No perteneces a esta liga privada. Debes unirte primero con un código de invitación válido.");
        }

        // Obtener o crear la predicción principal del usuario en esta liga
        Prediction prediction = predictionRepository.findByUserGoogleEmailAndEditionLeagueId(email, groupId)
                .orElseGet(() -> {
                    String predName = "Pronósticos de " + user.getParticipantName();
                    Membership membership = membershipRepository.findById(memId).orElse(null);
                    String paymentStatus = membership != null && membership.getPaymentStatus() != null
                            ? membership.getPaymentStatus()
                            : "PENDING";
                    return predictionRepository.save(Prediction.builder()
                            .user(user)
                            .edition(edition)
                            .name(predName)
                            .paymentStatus(paymentStatus)
                            .createdAt(LocalDateTime.now())
                            .build());
                });

        

        LocalDateTime now = LocalDateTime.now();
        int savedCount = 0;

        for (MatchPredictionItemDTO item : items) {
            if (item.getMatchId() == null) continue;

            Match match = matchRepository.findById(item.getMatchId())
                    .orElseThrow(() -> new IllegalArgumentException("Partido no encontrado con ID: " + item.getMatchId()));

            if (edition.getCompetition() == null || match.getCompetition() == null
                    || !Objects.equals(edition.getCompetition().getId(), match.getCompetition().getId())) {
                throw new IllegalArgumentException("El partido no pertenece a la competición de esta liga.");
            }

            // Comprobación estricta de fecha límite por partido individual
            if (Boolean.TRUE.equals(match.getFinished())) {
                throw new IllegalStateException(String.format("El partido %s vs %s ya ha finalizado y no puede modificarse.",
                        match.getHomeTeam() != null ? match.getHomeTeam().getName() : "Local",
                        match.getAwayTeam() != null ? match.getAwayTeam().getName() : "Visitante"));
            }
            if (match.getStatus() != null && !match.getStatus().isOpenForPrediction()) {
                throw new IllegalStateException("El estado del partido no admite pronósticos.");
            }
            if (match.getMatchDate() != null && !match.getMatchDate().isAfter(now)) {
                throw new IllegalStateException(String.format("El partido %s vs %s ya ha comenzado (hora de inicio: %s) y su pronóstico está bloqueado.",
                        match.getHomeTeam() != null ? match.getHomeTeam().getName() : "Local",
                        match.getAwayTeam() != null ? match.getAwayTeam().getName() : "Visitante",
                        match.getMatchDate()));
            }

            // Calcular signo automáticamente si no se especifica explícitamente pero hay goles
            String sign = item.getSign();
            if ((item.getHomeScore() == null) != (item.getAwayScore() == null)) {
                throw new IllegalArgumentException("Completa los dos marcadores del partido.");
            }
            if (item.getHomeScore() != null && item.getAwayScore() != null) {
                int cmp = Integer.compare(item.getHomeScore(), item.getAwayScore());
                sign = cmp > 0 ? "1" : (cmp == 0 ? "X" : "2");
            }
            if (!Set.of("1", "X", "2").contains(sign == null ? "" : sign)) {
                throw new IllegalArgumentException("El pronóstico debe incluir un marcador completo o un signo 1, X o 2.");
            }

            MatchPrediction matchPred = matchPredictionRepository.findByPredictionIdAndMatchId(prediction.getId(), match.getId())
                    .orElseGet(() -> MatchPrediction.builder()
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

    /**
     * Evalúa y actualiza los puntos de todos los pronósticos de un partido terminado.
     * Se puede repetir: si el marcador final cambia, los puntos se recalculan desde cero.
     */
    @Transactional
    @CacheEvict(value = "leaderboard", allEntries = true)
    public void evaluatePredictionsForMatch(Match match) {
        if (match == null || !Boolean.TRUE.equals(match.getFinished()) || match.getId() == null || match.getHomeScore() == null || match.getAwayScore() == null) {
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

        for (Prediction pred : affectedPredictions) {
            pred.setScoreCalculatedAt(null);
            predictionRepository.save(pred);
        }
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
            throw new IllegalArgumentException("El grupo y el partido son obligatorios");
        }

        Match match = matchRepository.findById(matchId)
                .orElseThrow(() -> new IllegalArgumentException("Partido no encontrado: " + matchId));

        Edition edition = editionRepository.findByLeagueIdAndStatus(groupId, "ACTIVE").orElse(null);

        UserAccount caller = (email != null && !email.isBlank())
                ? userAccountRepository.findByGoogleEmail(email)
                    .or(() -> userAccountRepository.findByParticipantNameIgnoreCase(email))
                    .orElse(null)
                : null;

        if (!League.isGlobalId(groupId)) {
            boolean isMember = false;
            if (caller != null) {
                    Membership.MembershipId memId = new Membership.MembershipId(caller.getId(), groupId);
                    isMember = membershipRepository.existsById(memId);
                }
            if (!isMember) {
                throw new SecurityException("No perteneces a esta liga privada.");
            }
        }

        LocalDateTime now = LocalDateTime.now();
        boolean isMatchLocked = Boolean.TRUE.equals(match.getFinished())
                || (match.getStatus() != null && !match.getStatus().isOpenForPrediction())
                || (match.getMatchDate() != null && !match.getMatchDate().isAfter(now))
                || (edition != null && edition.isLocked());

        // Obtener miembros del grupo
        List<Membership> memberships = membershipRepository.findByLeagueId(groupId);
        Map<Long, UserAccount> memberMap = new LinkedHashMap<>();
        for (Membership m : memberships) {
            if (m.getUser() != null) {
                memberMap.put(m.getUser().getId(), m.getUser());
            }
        }

        // Obtener todas las predicciones del partido en esta liga
        List<MatchPrediction> matchPreds = matchPredictionRepository.findByMatchId(matchId).stream()
                .filter(mp -> mp.getPrediction() != null && mp.getPrediction().getEdition() != null
                        && mp.getPrediction().getEdition().getLeague() != null
                        && groupId.equals(mp.getPrediction().getEdition().getLeague().getId()))
                .collect(Collectors.toList());

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
                    builder.scoringDetails("🔒 Pronóstico oculto hasta el pitido inicial");
                }
            } else {
                builder.hasPredicted(false)
                        .scoringDetails(isMatchLocked ? "❌ Sin pronóstico (0 pts)" : "⏳ Pendiente de pronosticar");
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
