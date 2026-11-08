package com.porra.mundial.service.prediction;

import com.porra.mundial.dto.FightInfoDTO;
import com.porra.mundial.model.Fight;
import com.porra.mundial.model.FightMethod;
import com.porra.mundial.model.Sport;
import com.porra.mundial.repository.FightRepository;
import com.porra.mundial.scoring.FightScoring;
import com.porra.mundial.exception.BusinessException;
import com.porra.mundial.dto.MatchPredictionItemDTO;
import com.porra.mundial.dto.MatchdayFixturePredictionDTO;
import com.porra.mundial.dto.MatchdayFriendPredictionDTO;
import com.porra.mundial.model.*;
import com.porra.mundial.repository.*;
import com.porra.mundial.scoring.MatchScoreResult;
import com.porra.mundial.scoring.MatchScoringCalculator;
import com.porra.mundial.scoring.ScoringRuleSet;
import com.porra.mundial.scoring.TennisScoring;
import com.porra.mundial.util.MatchRound;
import com.porra.mundial.sports.NflSchedule;
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
    private final MatchSelectionService matchSelectionService;
    private final FightRepository fightRepository;

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

        if (edition == null || !PoolFormat.isMatchBased(edition.getPoolFormat())) {
            return java.util.Collections.emptyList();
        }

        if (edition.getCompetition() == null) {
            throw BusinessException.conflict("La liga no tiene una competición configurada.");
        }
        Long competitionId = edition.getCompetition().getId();
        List<Match> matches;
        if (edition.isMultiCompetition()) {
            // Varias competiciones: la jornada es la semana de la liga, que no se guarda en los partidos.
            String cleanRound = round == null ? "" : round.trim();
            matches = MatchSelectionService.leagueCalendar(matchSelectionService, edition, matchRepository::findByCompetitionId).stream()
                    .filter(m -> cleanRound.isEmpty() || cleanRound.equalsIgnoreCase(MatchRound.label(edition, m)))
                    .sorted(Comparator.comparing(Match::getMatchDate, Comparator.nullsLast(Comparator.naturalOrder())))
                    .collect(Collectors.toList());
        } else if (round != null && !round.isBlank()) {
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
        // Una liga que elige sus partidos solo ve los suyos.
        if (MatchSelectionService.selects(edition)) {
            matches = matchSelectionService.filter(edition, matches);
        }

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
        Map<Long, Fight> fights = fightsOf(matches);

        Instant now = Instant.now();
        Map<Long, Instant> lockTimes = MatchdayLock.lockTimes(edition, matches,
                MatchdayLock.needsWholeCalendar(edition) ? MatchSelectionService.leagueCalendar(matchSelectionService, edition, matchRepository::findByCompetitionId) : matches);
        boolean multiCompetition = edition.isMultiCompetition();
        List<MatchdayFixturePredictionDTO> result = new ArrayList<>();

        for (Match match : matches) {
            MatchPrediction mp = predictionMap.get(match.getId());
            Fight fight = fights.get(match.getId());

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
                lockReason = fight != null && match.getStatus() == com.porra.mundial.model.MatchStatusNormalized.CANCELLED
                        ? "Pelea cancelada: no puntúa" : "El estado del partido no admite predicciones";
            } else if (lockTimes.containsKey(match.getId()) && !lockTimes.get(match.getId()).isAfter(now)) {
                isLocked = true;
                lockReason = MatchdayLock.reason(edition, match, now);
            } else if (MatchdayLock.awaitingTeams(match)) {
                isLocked = true;
                lockReason = MatchdayLock.awaitingTeamsReason(match);
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
                if (TennisScoring.applies(match) ? TennisScoring.decided(match)
                        : hasScorableResult(match) && match.getHomeScore() != null && match.getAwayScore() != null) {
                    MatchScoreResult scoreResult = scorePrediction(mp, match, fight, rules);
                    if (scoreResult != null) {
                        pointsAwarded = scoreResult.totalPoints();
                        isExact = scoreResult.exactScore();
                        isCorrectSign = scoreResult.correctSign();
                        scoringDetails = scoreResult.explanation();
                    }
                }
            }

            boolean tennis = TennisScoring.applies(match);
            result.add(MatchdayFixturePredictionDTO.builder()
                    .matchId(match.getId())
                    .setsToWin(tennis ? TennisScoring.setsToWin(match.getCompetition()) : null)
                    .winnerSign(tennis ? TennisScoring.winnerSign(match) : null)
                    .homeTeam(match.getHomeTeam() != null ? match.getHomeTeam().getName() : Team.PLACEHOLDER_NAME)
                    .awayTeam(match.getAwayTeam() != null ? match.getAwayTeam().getName() : Team.PLACEHOLDER_NAME)
                    .homeTeamId(match.getHomeTeam() != null ? match.getHomeTeam().getId() : null)
                    .awayTeamId(match.getAwayTeam() != null ? match.getAwayTeam().getId() : null)
                    .homeTeamLogo(match.getHomeTeam() != null ? match.getHomeTeam().getLogoUrl() : null)
                    .awayTeamLogo(match.getAwayTeam() != null ? match.getAwayTeam().getLogoUrl() : null)
                    .matchDate(match.getMatchDate())
                    .round(MatchRound.label(edition, match))
                    // En una liga de varias competiciones la jornada es la semana, no el grupo.
                    .groupName(multiCompetition ? null : match.getGroupName())
                    .competitionName(multiCompetition && match.getCompetition() != null
                            ? match.getCompetition().getName() : null)
                    .sport(match.getCompetition() != null
                            ? Sport.ofExternalId(match.getCompetition().getExternalId()).name() : null)
                    .finished(match.getFinished())
                    .status(match.getStatus() != null ? match.getStatus().name() : null)
                    .actualHomeScore(match.getHomeScore())
                    .actualAwayScore(match.getAwayScore())
                    .displayClock(match.getDisplayClock())
                    .predHomeScore(mp != null ? mp.getHomeScore() : null)
                    .predAwayScore(mp != null ? mp.getAwayScore() : null)
                    .predSign(mp != null ? mp.getPredictionSign() : null)
                    .predMethod(mp != null ? mp.getPredictedMethod() : null)
                    .predRound(mp != null ? mp.getPredictedRound() : null)
                    .fight(FightInfoDTO.of(fight, match))
                    .locked(isLocked)
                    .awaitingTeams(MatchdayLock.awaitingTeams(match))
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

    /** Situación del usuario en una liga superviviente: vivo o eliminado y equipos ya elegidos. */
    @Transactional(readOnly = true)
    public com.porra.mundial.dto.SurvivorStatusDTO getSurvivorStatus(String email, Long groupId) {
        if (groupId == null) throw BusinessException.badRequest("El identificador de grupo es obligatorio");
        Edition edition = editionRepository.findByLeagueIdAndStatus(groupId, "ACTIVE").orElse(null);
        if (edition == null || edition.getPoolFormat() != PoolFormat.SURVIVOR || email == null || email.isBlank()) {
            return com.porra.mundial.dto.SurvivorStatusDTO.empty();
        }
        UserAccount user = userAccountRepository.findByGoogleEmail(email).orElse(null);
        if (user == null) return com.porra.mundial.dto.SurvivorStatusDTO.empty();
        Prediction prediction = predictionRepository.findByUserGoogleEmailAndEditionLeagueId(email, groupId).orElse(null);

        List<MatchPrediction> picks = prediction != null ? survivorPicks(prediction) : List.of();
        SurvivorRules.Settings settings = SurvivorRules.Settings.of(edition);
        SurvivorRules.Standing standing = survivorStanding(edition, user.getId(), prediction, picks);
        List<com.porra.mundial.dto.SurvivorStatusDTO.Pick> items = picks.stream()
                .filter(pick -> pick.getMatch() != null)
                .sorted(Comparator.comparing(pick -> pick.getMatch().getMatchDate(),
                        Comparator.nullsLast(Comparator.naturalOrder())))
                .map(pick -> {
                    Team team = SurvivorRules.pickedTeam(pick);
                    String result = !SurvivorRules.isDecided(pick.getMatch()) ? "PENDING"
                            : SurvivorRules.survives(pick, settings) ? "WON" : "LOST";
                    return new com.porra.mundial.dto.SurvivorStatusDTO.Pick(pick.getMatch().getId(),
                            MatchRound.label(pick.getMatch()),
                            team != null ? team.getId() : null,
                            team != null ? team.getName() : null,
                            team != null ? team.getLogoUrl() : null,
                            result);
                })
                .toList();
        return new com.porra.mundial.dto.SurvivorStatusDTO(standing.eliminated(), standing.survived(),
                standing.eliminatedRound(), standing.missed(), items, standing.livesLeft(), settings.lives(),
                settings.drawSurvives());
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

        if (!PoolFormat.isMatchBased(edition.getPoolFormat())) {
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
                ? MatchSelectionService.leagueCalendar(matchSelectionService, edition, matchRepository::findByCompetitionId) : null;
        int savedCount = 0;
        boolean survivor = edition.getPoolFormat() == PoolFormat.SURVIVOR;
        List<MatchPrediction> survivorPicks = survivor ? survivorPicks(prediction) : List.of();
        if (survivor && survivorStanding(edition, user.getId(), prediction, survivorPicks).eliminated()) {
            throw BusinessException.conflict("Ya estás eliminado de esta liga superviviente.");
        }
        Set<String> survivorRounds = new HashSet<>();
        MatchSelection selection = MatchSelectionService.selects(edition) ? matchSelectionService.of(edition) : null;
        EventSeries series = MatchSelectionService.series(edition);
        Set<CardSegment> segments = MatchSelectionService.segments(edition);
        Set<Long> leagueCompetitions = Set.copyOf(MatchSelectionService.competitionIds(matchSelectionService, edition));

        // Dos consultas para toda la jornada en vez de dos por partido.
        List<Long> matchIds = items.stream().map(MatchPredictionItemDTO::getMatchId)
                .filter(Objects::nonNull).distinct().toList();
        Map<Long, Match> matchesById = matchRepository.findAllById(matchIds).stream()
                .collect(Collectors.toMap(Match::getId, m -> m));
        Map<Long, MatchPrediction> existingByMatchId = prediction.getId() == null || matchIds.isEmpty()
                ? new HashMap<>()
                : matchPredictionRepository.findByPredictionIdAndMatchIdIn(prediction.getId(), matchIds).stream()
                        .collect(Collectors.toMap(mp -> mp.getMatch().getId(), mp -> mp, (a, b) -> a));
        Map<Long, String> fightSegments = segments == null ? Map.of() : matchSelectionService.fightSegments(matchIds);

        for (MatchPredictionItemDTO item : items) {
            if (item.getMatchId() == null) continue;

            Match match = matchesById.get(item.getMatchId());
            if (match == null) throw BusinessException.notFound("Partido no encontrado");

            if (match.getCompetition() == null || !leagueCompetitions.contains(match.getCompetition().getId())) {
                throw BusinessException.badRequest("El partido no pertenece a la competición de esta liga.");
            }
            if (selection != null && !selection.contains(match) || !EventSeries.includes(series, match.getRound())
                    || !CardSegment.includes(segments, fightSegments.get(match.getId()))
                    || !MatchSelectionService.inTennisWindow(edition, match)) {
                throw BusinessException.badRequest("Ese partido no entra en esta liga.");
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
            if (MatchdayLock.awaitingTeams(match)) {
                throw BusinessException.conflict(MatchdayLock.awaitingTeamsReason(match)
                        + ": aún no se puede predecir este partido.");
            }

            if (Sport.isMma(match.getCompetition())) {
                Fight fight = fightRepository.findById(match.getId()).orElse(null);
                MatchPrediction saved = existingByMatchId.computeIfAbsent(match.getId(), id -> MatchPrediction.builder()
                        .prediction(prediction)
                        .match(match)
                        .build());
                applyFightPick(saved, item, fight);
                matchPredictionRepository.save(saved);
                savedCount++;
                continue;
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
            if (TennisScoring.applies(match)) checkTennisPick(match, item, sign);
            if ("X".equals(sign) && !Sport.allowsDraws(match)) {
                throw BusinessException.badRequest("En este deporte se predice quién gana: no hay empate.");
            }
            if (survivor) {
                if (item.getHomeScore() != null || "X".equals(sign)) {
                    throw BusinessException.badRequest("En el modo superviviente se elige un equipo que gane, sin marcador ni empate.");
                }
                if (!survivorRounds.add(MatchRound.label(match))) {
                    throw BusinessException.badRequest("Solo puedes elegir un equipo por jornada.");
                }
                checkSurvivorPick(edition, match, sign, survivorPicks, calendar, now);
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
        if (match == null || !hasScorableResult(match) || match.getId() == null) return;
        // La sincronización lo guarda fuera de esta sesión: su competición (perezosa) no se podría leer.
        if (match.getCompetition() != null && !org.hibernate.Hibernate.isInitialized(match.getCompetition())) {
            match = matchRepository.findById(match.getId()).orElse(match);
        }
        invalidateSurvivorEditions(match);
        // En tenis solo puntúa el partido terminado; una retirada o un W.O. tienen ganador sin marcador.
        if (TennisScoring.applies(match) ? !TennisScoring.decided(match)
                : match.getHomeScore() == null || match.getAwayScore() == null) return;

        List<MatchPrediction> predictions = matchPredictionRepository.findByMatchId(match.getId());
        // El partido puede llegar sin sesión (sincronización): se mira por su id si es una pelea.
        Fight fight = predictions.isEmpty() ? null : fightRepository.findById(match.getId()).orElse(null);
        Set<Prediction> affectedPredictions = new HashSet<>();
        for (MatchPrediction mp : predictions) {
            ScoringRuleSet rules = ScoringRuleSet.forEdition(mp.getPrediction() != null ? mp.getPrediction().getEdition() : null);
            MatchScoreResult result = scorePrediction(mp, match, fight, rules);
            if (result == null) continue;
            applyScore(mp, result);
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

    /**
     * Superviviente: al empezar o terminar un partido también puede caer quien no eligió en su
     * jornada, que no tiene pronóstico en este partido; se recalcula toda la edición.
     */
    private void invalidateSurvivorEditions(Match match) {
        if (match.getCompetition() == null) return;
        for (Edition edition : editionRepository.findActiveByPoolFormat(PoolFormat.SURVIVOR)) {
            if (edition.getCompetition() != null
                    && Objects.equals(edition.getCompetition().getId(), match.getCompetition().getId())) {
                scoreInvalidationService.invalidateEdition(edition.getId());
            }
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
        List<MatchPrediction> all = matchPredictionRepository.findWithMatchByPredictionEditionId(edition.getId());
        Map<Long, Fight> fights = Sport.isMma(edition.getCompetition())
                ? fightsOf(all.stream().map(MatchPrediction::getMatch).filter(Objects::nonNull).toList()) : Map.of();
        for (MatchPrediction mp : all) {
            Match match = mp.getMatch();
            if (match == null || !Boolean.TRUE.equals(match.getFinished())
                    || (TennisScoring.applies(match) ? !TennisScoring.decided(match)
                            : match.getHomeScore() == null || match.getAwayScore() == null)) {
                continue;
            }
            MatchScoreResult result = scorePrediction(mp, match, fights.get(match.getId()), rules);
            if (result == null) continue;
            applyScore(mp, result);
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

    /**
     * Situación en una liga superviviente con todo el calendario: también cuenta como caída una
     * jornada sin elegir que empezó después de que el usuario entrase en la liga.
     */
    private SurvivorRules.Standing survivorStanding(Edition edition, Long userId, Prediction prediction,
                                                    List<MatchPrediction> picks) {
        List<Match> calendar = edition.getCompetition() != null
                ? matchRepository.findByCompetitionId(edition.getCompetition().getId()) : List.of();
        Instant startAt = edition.getLeague() == null || userId == null ? null
                : membershipRepository.findById(new Membership.MembershipId(userId, edition.getLeague().getId()))
                        .map(Membership::getJoinedAt)
                        .orElse(prediction != null ? prediction.getCreatedAt() : null);
        return SurvivorRules.standing(picks, calendar, startAt, Instant.now(), SurvivorRules.Settings.of(edition));
    }

    /** Elecciones ya guardadas de una porra superviviente, con su partido. */
    private List<MatchPrediction> survivorPicks(Prediction prediction) {
        return prediction.getId() == null ? List.of()
                : matchPredictionRepository.findWithMatchByPredictionIdIn(List.of(prediction.getId()));
    }

    /**
     * Una elección por jornada y sin repetir equipo. Elegir otro partido de la misma jornada sustituye
     * la elección anterior, salvo que su partido ya esté cerrado.
     */
    private void checkSurvivorPick(Edition edition, Match match, String sign, List<MatchPrediction> picks,
                                   List<Match> calendar, Instant now) {
        Team team = SurvivorRules.pickedTeam(sign, match);
        if (team == null || team.getId() == null || Team.isPlaceholder(team)) {
            throw BusinessException.badRequest("Ese equipo aún no está definido.");
        }
        String round = MatchRound.label(match);
        for (MatchPrediction other : picks) {
            Match otherMatch = other.getMatch();
            if (otherMatch == null || Objects.equals(otherMatch.getId(), match.getId())) continue;
            if (round.equals(MatchRound.label(otherMatch))) {
                Instant otherLock = MatchdayLock.lockTimes(edition, List.of(otherMatch),
                        calendar == null ? List.of(otherMatch) : calendar).get(otherMatch.getId());
                boolean otherLocked = Boolean.TRUE.equals(otherMatch.getFinished())
                        || (otherMatch.getStatus() != null && !otherMatch.getStatus().isOpenForPrediction())
                        || (otherLock != null && !otherLock.isAfter(now));
                if (otherLocked) {
                    throw BusinessException.conflict("Tu elección de esta jornada ya está cerrada.");
                }
                matchPredictionRepository.delete(other);
                continue;
            }
            Team used = SurvivorRules.pickedTeam(other);
            if (used != null && Objects.equals(used.getId(), team.getId())) {
                String usedRound = MatchRound.label(otherMatch);
                // NFL: «en la Semana 9» / «en la Ronda divisional»; en el fútbol, «en Jornada 9».
                String at = NflSchedule.isRoundLabel(usedRound) ? "la " + usedRound : usedRound;
                throw BusinessException.conflict(String.format("Ya elegiste a %s en %s.", team.getName(), at));
            }
        }
    }

    /** Tenis: no hay empate y, si se dan los sets, tienen que ser un resultado posible (2-1, 3-0…). */
    private static void checkTennisPick(Match match, MatchPredictionItemDTO item, String sign) {
        if ("X".equals(sign)) {
            throw BusinessException.badRequest("En tenis no hay empate: elige quién gana.");
        }
        if (item.getHomeScore() != null && item.getAwayScore() != null && !TennisScoring.validSets(
                item.getHomeScore(), item.getAwayScore(), TennisScoring.setsToWin(match.getCompetition()))) {
            throw BusinessException.badRequest("Ese resultado en sets no es posible en este partido.");
        }
    }

    private static boolean isSurvivor(MatchPrediction prediction) {
        return prediction.getPrediction() != null && prediction.getPrediction().getEdition() != null
                && prediction.getPrediction().getEdition().getPoolFormat() == PoolFormat.SURVIVOR;
    }

    /** Datos de pelea de los partidos de la UFC de la lista, por id de partido. */
    private Map<Long, Fight> fightsOf(List<Match> matches) {
        List<Long> ids = matches.stream()
                .filter(m -> m.getId() != null && Sport.isMma(m.getCompetition()))
                .map(Match::getId)
                .toList();
        if (ids.isEmpty()) return Map.of();
        return fightRepository.findByMatchIdIn(ids).stream().collect(Collectors.toMap(Fight::getMatchId, f -> f));
    }

    /**
     * Predicción de una pelea: el ganador ("1" esquina roja, "2" azul) y, si se quiere, el método y el asalto.
     * El asalto solo vale con un KO/TKO o una sumisión y dentro de los asaltos previstos.
     */
    static void applyFightPick(MatchPrediction prediction, MatchPredictionItemDTO item, Fight fight) {
        String sign = item.getSign() == null ? "" : item.getSign().trim();
        if (!Set.of("1", "2").contains(sign) || item.getHomeScore() != null || item.getAwayScore() != null) {
            throw BusinessException.badRequest("En una pelea se elige quién gana: 1 o 2, sin marcador.");
        }
        FightMethod method = null;
        if (item.getMethod() != null && !item.getMethod().isBlank()) {
            method = FightMethod.predicted(item.getMethod());
            if (method == null) {
                throw BusinessException.badRequest("El método tiene que ser KO/TKO, sumisión o decisión.");
            }
        }
        Integer round = item.getRound();
        if (round != null) {
            int scheduled = fight != null && fight.getScheduledRounds() != null ? fight.getScheduledRounds() : 5;
            if (method == null || !method.finish()) {
                throw BusinessException.badRequest("El asalto solo se elige con un KO/TKO o una sumisión.");
            }
            if (round < 1 || round > scheduled) {
                throw BusinessException.badRequest(String.format("Esta pelea es a %d asaltos.", scheduled));
            }
        }
        prediction.setHomeScore(null);
        prediction.setAwayScore(null);
        prediction.setPredictionSign(sign);
        prediction.setPredictedMethod(method != null ? method.name() : null);
        prediction.setPredictedRound(round);
        prediction.setPointsAwarded(null);
        prediction.setIsExactScore(null);
        prediction.setIsCorrectSign(null);
        prediction.setScoringDetails(null);
    }

    /** Puntos de una predicción; null si es una pelea que aún no ha acabado. */
    private MatchScoreResult scorePrediction(MatchPrediction prediction, Match match, Fight fight, ScoringRuleSet rules) {
        if (fight != null) {
            return FightScoring.score(prediction.getPredictionSign(), prediction.getPredictedMethod(),
                    prediction.getPredictedRound(), match, fight, rules);
        }
        return scorePrediction(prediction, match, rules);
    }

    private MatchScoreResult scorePrediction(MatchPrediction prediction, Match match, ScoringRuleSet rules) {
        if (isSurvivor(prediction)) {
            return SurvivorRules.score(prediction.getPredictionSign(), match.getHomeScore(), match.getAwayScore(),
                    SurvivorRules.pickedTeam(prediction.getPredictionSign(), match),
                    SurvivorRules.Settings.of(prediction.getPrediction().getEdition()));
        }
        if (TennisScoring.applies(match)) {
            return TennisScoring.score(prediction.getPredictionSign(), prediction.getHomeScore(),
                    prediction.getAwayScore(), match, rules);
        }
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
        Instant lockAt = edition == null || !PoolFormat.isMatchBased(edition.getPoolFormat())
                ? match.getMatchDate()
                : MatchdayLock.lockTimes(edition, List.of(match), MatchdayLock.needsWholeCalendar(edition)
                        && match.getCompetition() != null
                        ? MatchSelectionService.leagueCalendar(matchSelectionService, edition, matchRepository::findByCompetitionId) : List.of(match))
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
                            .method(mp.getPredictedMethod())
                            .round(mp.getPredictedRound())
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
