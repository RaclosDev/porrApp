package com.porra.mundial.service.prediction;

import com.porra.mundial.service.tournament.OfficialResultsService;
import com.porra.mundial.service.tournament.TopScorerService;
import com.porra.mundial.dto.PredictionDataDTO;
import com.porra.mundial.dto.MatchdayPointsDTO;
import com.porra.mundial.dto.ParticipantScoreDTO;
import com.porra.mundial.dto.TopScorerDTO;
import com.porra.mundial.model.Edition;
import com.porra.mundial.model.Prediction;
import com.porra.mundial.model.Match;
import com.porra.mundial.model.MatchPrediction;
import com.porra.mundial.model.MatchStatusNormalized;
import com.porra.mundial.repository.EditionRepository;
import com.porra.mundial.repository.PredictionRepository;
import com.porra.mundial.repository.MatchRepository;
import com.porra.mundial.repository.MatchPredictionRepository;
import com.porra.mundial.repository.MembershipRepository;
import com.porra.mundial.model.Membership;
import com.porra.mundial.util.MatchRound;
import com.porra.mundial.scoring.CalculationContext;
import com.porra.mundial.scoring.ScoringRuleSet;
import com.porra.mundial.scoring.ScoringStrategy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

/** Clasificación de una liga: puntos del cuadro y de las jornadas, guardados en cada porra. */
@Service
@RequiredArgsConstructor
@Slf4j
public class LeaderboardService {

    private final PredictionRepository predictionRepository;
    private final TopScorerService topScorerService;
    private final MatchRepository matchRepository;
    private final OfficialResultsService officialResultsService;
    /** Estrategia base: cada edición puntúa con ella y sus propias reglas ({@link ScoringStrategy#withRules}). */
    private final ScoringStrategy scoringStrategy;
    private final MatchPredictionRepository matchPredictionRepository;
    private final MembershipRepository membershipRepository;
    private final EditionRepository editionRepository;
    private final CustomBracketScoringService customBracketScoringService;
    private final MatchSelectionService matchSelectionService;

    /** Clasificación: más puntos, quien sigue vivo en superviviente, más puntos por partido, nombre. */
    private static final Comparator<ParticipantScoreDTO> LEADERBOARD_ORDER = Comparator
            .comparingInt(ParticipantScoreDTO::getTotal).reversed()
            .thenComparing(ParticipantScoreDTO::isEliminated)
            .thenComparing(Comparator.comparingInt(ParticipantScoreDTO::getMatchPoints).reversed())
            .thenComparing(score -> score.getName() != null ? score.getName() : "", String.CASE_INSENSITIVE_ORDER);

    @Cacheable(value = "leaderboard", key = "#groupId != null ? #groupId : 0L", sync = true)
    @org.springframework.transaction.annotation.Transactional
    public List<ParticipantScoreDTO> getLeaderboard(Long groupId) {
        List<Prediction> groupPredictions = groupId != null
                ? predictionRepository.findByEditionLeagueIdWithUserAndEdition(groupId)
                : predictionRepository.findAllWithUserAndEdition();

        Map<Long, String> membershipPayment = getMembershipPaymentStatus(groupId);
        // Los puntos guardados siguen valiendo hasta que algo los invalida (score_calculated_at a null):
        // solo se recalculan esas porras, para que guardar una predicción no obligue a puntuar toda la liga.
        List<ParticipantScoreDTO> leaderboard = new ArrayList<>(groupPredictions.size());
        List<Prediction> stale = new ArrayList<>();
        for (Prediction pred : groupPredictions) {
            if (pred.getScoreCalculatedAt() != null) {
                leaderboard.add(materializedScore(pred, membershipPayment));
            } else {
                stale.add(pred);
            }
        }

        if (!stale.isEmpty()) {
            OfficialResultsService.OfficialResults official = officialResultsService.current();
            boolean pichichiActive = stale.stream()
                    .anyMatch(p -> p.getEdition() != null && p.getEdition().scoresPichichi());
            List<TopScorerDTO> scorers = pichichiActive ? topScorerService.getTopScorers() : Collections.emptyList();

            Map<Long, List<MatchPrediction>> matchPredsByPrediction = matchPredictionsByPrediction(stale);
            SurvivorContext survivors = new SurvivorContext();
            // Una estrategia por juego de reglas: en la clasificación global conviven ediciones con reglas distintas.
            Map<String, ScoringStrategy> strategiesByRules = new HashMap<>();

            Map<Long, ParticipantScoreDTO> toUpdate = new HashMap<>();
            // Porras supervivientes: además de los puntos se guarda si ya han caído.
            Set<Long> survivorIds = new HashSet<>();
            for (Prediction pred : stale) {
                List<MatchPrediction> matchPreds = matchPredsByPrediction.getOrDefault(pred.getId(), List.of());
                if (pred.getBracketData() == null && matchPreds.isEmpty()) continue;

                ScoringRuleSet effectiveRules = ScoringRuleSet.effectiveForEdition(pred.getEdition());
                ScoringStrategy strategy = strategiesByRules.computeIfAbsent(effectiveRules.toJson(),
                        json -> scoringStrategy.withRules(effectiveRules));
                ParticipantScoreDTO score = scorePrediction(pred, matchPreds, official, scorers, strategy, survivors);
                score.setPending(isPaymentPending(pred, membershipPayment));
                leaderboard.add(score);
                if (pred.getId() != null) {
                    toUpdate.put(pred.getId(), score);
                    if (pred.getEdition() != null
                            && pred.getEdition().getPoolFormat() == com.porra.mundial.model.PoolFormat.SURVIVOR) {
                        survivorIds.add(pred.getId());
                    }
                }
            }

            if (!toUpdate.isEmpty()) {
                try {
                    // Solo columnas de puntos: un saveAll de la entidad entera pisaría una predicción guardada a la vez.
                    java.time.Instant now = java.time.Instant.now();
                    toUpdate.forEach((id, score) -> predictionRepository.saveCalculatedScore(id, score.getTotal(),
                            score.getR1(), score.getR32(), score.getR16(), score.getQf(), score.getSf(),
                            score.getFinals(), score.getScorer(), score.getMatchPoints(), now));
                    survivorIds.forEach(id -> predictionRepository.saveSurvivorEliminated(id,
                            toUpdate.get(id).isEliminated()));
                } catch (Exception e) {
                    log.warn("Could not save materialized prediction scores: {}", e.getMessage());
                }
            }
        }

        addLeagueMembersWithoutPredictions(groupId, leaderboard);
        leaderboard.sort(LEADERBOARD_ORDER);
        return leaderboard;
    }

    /** Cuándo cayó cada porra superviviente eliminada (su partido o la jornada que no eligió). */
    private Map<Long, java.time.Instant> survivorEliminations(Edition edition, List<MatchPrediction> picks) {
        Map<Long, java.time.Instant> eliminatedAt = new HashMap<>();
        SurvivorContext survivors = new SurvivorContext();
        picks.stream()
                .filter(pick -> pick != null && pick.getPrediction() != null && pick.getPrediction().getId() != null)
                .collect(Collectors.groupingBy(MatchPrediction::getPrediction))
                .forEach((prediction, own) -> {
                    Long id = prediction.getId();
                    SurvivorRules.Standing standing = survivors.standing(edition,
                            prediction.getUser() != null ? prediction.getUser().getId() : null,
                            prediction.getCreatedAt(), own);
                    if (standing.eliminated() && standing.eliminatedAt() != null) eliminatedAt.put(id, standing.eliminatedAt());
                });
        return eliminatedAt;
    }

    /** Elección hecha de antemano para un partido posterior al que eliminó a su porra: ya no suma. */
    private static boolean afterElimination(MatchPrediction pick, java.time.Instant eliminatedAt) {
        return eliminatedAt != null && pick.getMatch() != null && pick.getMatch().getMatchDate() != null
                && pick.getMatch().getMatchDate().isAfter(eliminatedAt);
    }

    /** Una sola consulta para los pronósticos por partido de todas las porras de la clasificación. */
    /** Fila de la clasificación con los puntos ya guardados de la porra. */
    private ParticipantScoreDTO materializedScore(Prediction pred, Map<Long, String> membershipPayment) {
        return ParticipantScoreDTO.builder()
                .id(pred.getId())
                .userId(pred.getUser() != null ? pred.getUser().getId() : null)
                .name(com.porra.mundial.util.TextSanitizer.fixParticipantName(pred.getParticipantName()))
                .predictionName(pred.getPredictionName())
                .avatarUrl(pred.getUser() != null ? pred.getUser().getAvatarUrl() : null)
                .pending(isPaymentPending(pred, membershipPayment))
                .total(pred.getTotalPoints() != null ? pred.getTotalPoints() : 0)
                .r1(pred.getR1Points() != null ? pred.getR1Points() : 0)
                .r32(pred.getR32Points() != null ? pred.getR32Points() : 0)
                .r16(pred.getR16Points() != null ? pred.getR16Points() : 0)
                .qf(pred.getQfPoints() != null ? pred.getQfPoints() : 0)
                .sf(pred.getSfPoints() != null ? pred.getSfPoints() : 0)
                .finals(pred.getFinalsPoints() != null ? pred.getFinalsPoints() : 0)
                .scorer(pred.getScorerPoints() != null ? pred.getScorerPoints() : 0)
                .matchPoints(pred.getMatchPoints() != null ? pred.getMatchPoints() : 0)
                .eliminated(pred.isSurvivorEliminated())
                .log(new ArrayList<>())
                .exactMatches(new HashMap<>())
                .passedTeams(new HashMap<>())
                .build();
    }

    private Map<Long, List<MatchPrediction>> matchPredictionsByPrediction(List<Prediction> predictions) {
        List<Long> ids = predictions.stream().map(Prediction::getId).filter(Objects::nonNull).toList();
        if (ids.isEmpty()) return Map.of();
        return matchPredictionRepository.findWithMatchByPredictionIdIn(ids).stream()
                .collect(Collectors.groupingBy(mp -> mp.getPrediction().getId()));
    }

    /** Estado de pago por usuario, o null si la liga no cobra cuota (nadie queda pendiente). */
    private Map<Long, String> getMembershipPaymentStatus(Long groupId) {
        if (groupId == null) return Collections.emptyMap();
        Map<Long, String> statuses = new HashMap<>();
        for (Membership membership : membershipRepository.findByLeagueId(groupId)) {
            if (membership.getLeague() != null && !membership.getLeague().isEntryFee()) return null;
            if (membership.getUser() == null || membership.getUser().getId() == null) continue;
            statuses.put(membership.getUser().getId(),
                    membership.getPaymentStatus() != null ? membership.getPaymentStatus() : "PENDING");
        }
        return statuses;
    }

    private boolean isPaymentPending(Prediction pred, Map<Long, String> membershipPayment) {
        if (membershipPayment == null) return false;
        Long userId = pred.getUser() != null ? pred.getUser().getId() : null;
        if (userId != null) {
            String status = membershipPayment.get(userId);
            if (status != null) return !"PAID".equalsIgnoreCase(status);
        }
        return !Boolean.TRUE.equals(pred.getPaid());
    }

    private void addLeagueMembersWithoutPredictions(Long groupId, List<ParticipantScoreDTO> leaderboard) {
        if (groupId == null) return;
        // Superviviente: quien no ha elegido nunca también cae en cuanto se le pasa una jornada.
        Edition survivorEdition = editionRepository.findByLeagueIdAndStatus(groupId, "ACTIVE")
                .filter(edition -> edition.getPoolFormat() == com.porra.mundial.model.PoolFormat.SURVIVOR)
                .orElse(null);
        SurvivorContext survivors = new SurvivorContext();

        Set<Long> representedUserIds = new HashSet<>();
        for (ParticipantScoreDTO score : leaderboard) {
            if (score.getUserId() != null) representedUserIds.add(score.getUserId());
        }

        for (Membership membership : membershipRepository.findByLeagueId(groupId)) {
            if (membership.getUser() == null || membership.getUser().getId() == null) continue;
            var user = membership.getUser();
            if (user.getParticipantName() == null || user.getParticipantName().equalsIgnoreCase("Admin")) continue;
            if (!representedUserIds.add(user.getId())) continue;

            leaderboard.add(ParticipantScoreDTO.builder()
                    .id(null)
                    .userId(user.getId())
                    .name(com.porra.mundial.util.TextSanitizer.fixParticipantName(user.getParticipantName()))
                    .avatarUrl(user.getAvatarUrl())
                    .predictionName("")
                    .pending(false)
                    .r1(0).r32(0).r16(0).qf(0).sf(0).finals(0).scorer(0).matchPoints(0).total(0)
                    .eliminated(survivorEdition != null
                            && survivors.standing(survivorEdition, user.getId(), null, List.of()).eliminated())
                    .log(new ArrayList<>())
                    .exactMatches(new HashMap<>())
                    .passedTeams(new HashMap<>())
                    .build());
        }

        leaderboard.sort((a, b) -> {
            if (a.getTotal() != b.getTotal()) return Integer.compare(b.getTotal(), a.getTotal());
            if (a.getMatchPoints() != b.getMatchPoints()) return Integer.compare(b.getMatchPoints(), a.getMatchPoints());
            String nameA = a.getName() != null ? a.getName() : "";
            String nameB = b.getName() != null ? b.getName() : "";
            return nameA.compareToIgnoreCase(nameB);
        });
    }

    /**
     * Devuelve el desglose de puntos por jornada de todos los participantes de una liga.
     * Solo incluye puntos positivos; el frontend muestra 0 cuando no hay aciertos.
     *
     * @param groupId ID de la liga. Si es null se calcula sobre todas las porras.
     * @return Jornadas ordenadas cronológicamente con sus puntos por pronóstico.
     */
    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public List<MatchdayPointsDTO> getMatchdayBreakdown(Long groupId) {
        // Sin liga o sin edición activa no hay jornadas que desglosar: nunca se cargan las tablas enteras.
        Edition edition = groupId != null
                ? editionRepository.findByLeagueIdAndStatus(groupId, "ACTIVE").orElse(null)
                : null;
        if (edition == null || edition.getCompetition() == null) {
            return List.of();
        }

        List<Prediction> groupPredictions = predictionRepository.findByEditionLeagueIdWithUserAndEdition(groupId);

        Set<Long> participantPredictionIds = groupPredictions.stream()
                .map(Prediction::getId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        // Las jornadas de una liga que elige sus partidos son solo las que tienen alguno de los suyos; en
        // una que junta varias competiciones, sus semanas.
        List<Match> competitionMatches = MatchSelectionService.leagueCalendar(matchSelectionService, edition, matchRepository::findByCompetitionId);

        Map<String, MatchdayAccumulator> matchdays = new LinkedHashMap<>();
        competitionMatches.stream()
                .filter(Objects::nonNull)
                .filter(m -> m.getMatchDate() != null)
                .sorted(Comparator.comparing(Match::getMatchDate))
                .forEach(match -> {
                    String label = MatchRound.label(edition, match);
                    if (isUsableMatchdayLabel(label)) {
                        matchdays.computeIfAbsent(label, key -> new MatchdayAccumulator(label, match.getMatchDate()))
                                .addMatch(match);
                    }
                });

        List<MatchPrediction> matchPredictions = matchPredictionRepository.findByPredictionEditionLeagueId(groupId);
        Map<Long, java.time.Instant> eliminatedAt = edition.getPoolFormat() == com.porra.mundial.model.PoolFormat.SURVIVOR
                ? survivorEliminations(edition, matchPredictions) : Map.of();

        for (MatchPrediction matchPrediction : matchPredictions) {
            if (matchPrediction != null && matchPrediction.getPrediction() != null
                    && afterElimination(matchPrediction, eliminatedAt.get(matchPrediction.getPrediction().getId()))) {
                continue;
            }
            if (matchPrediction == null
                    || matchPrediction.getPointsAwarded() == null
                    || matchPrediction.getPointsAwarded() <= 0
                    || matchPrediction.getPrediction() == null
                    || matchPrediction.getPrediction().getId() == null
                    || matchPrediction.getMatch() == null
                    || !participantPredictionIds.contains(matchPrediction.getPrediction().getId())) {
                continue;
            }

            String label = MatchRound.label(edition, matchPrediction.getMatch());
            if (!isUsableMatchdayLabel(label)) continue;

            matchdays.computeIfAbsent(label,
                            key -> new MatchdayAccumulator(label, matchPrediction.getMatch().getMatchDate()))
                    .addPoints(matchPrediction.getPrediction().getId(), matchPrediction.getPointsAwarded());
        }

        List<MatchdayAccumulator> ordered = new ArrayList<>(matchdays.values());
        MatchRound.sortNumberedMatchdays(ordered, accumulator -> accumulator.label);

        int currentIndex = -1;
        int index = 0;
        for (MatchdayAccumulator accumulator : ordered) {
            if (!accumulator.finished) {
                currentIndex = index;
                break;
            }
            index++;
        }
        if (currentIndex < 0 && !matchdays.isEmpty()) {
            currentIndex = matchdays.size() - 1;
        }

        List<MatchdayPointsDTO> result = new ArrayList<>(matchdays.size());
        index = 0;
        for (MatchdayAccumulator accumulator : ordered) {
            result.add(MatchdayPointsDTO.builder()
                    .label(accumulator.label)
                    .date(accumulator.date)
                    .finished(accumulator.finished)
                    .current(index == currentIndex)
                    .matchCount(accumulator.matchCount)
                    .pointsByPrediction(accumulator.points)
                    .build());
            index++;
        }
        return result;
    }

    private boolean isUsableMatchdayLabel(String label) {
        return label != null && !label.isBlank() && !"Sin jornada".equalsIgnoreCase(label);
    }

    private static final class MatchdayAccumulator {
        private final String label;
        private final Map<Long, Integer> points = new HashMap<>();
        private Instant date;
        private int matchCount;
        private boolean finished = true;

        private MatchdayAccumulator(String label, Instant date) {
            this.label = label;
            this.date = date;
        }

        private void addMatch(Match match) {
            matchCount++;
            if (match.getMatchDate() != null && (date == null || match.getMatchDate().isBefore(date))) {
                date = match.getMatchDate();
            }
            if (isPlayablePending(match)) {
                finished = false;
            }
        }

        private void addPoints(Long predictionId, int pointsAwarded) {
            points.merge(predictionId, pointsAwarded, Integer::sum);
        }

        private boolean isPlayablePending(Match match) {
            if (Boolean.TRUE.equals(match.getFinished())) return false;
            MatchStatusNormalized status = match.getStatus();
            return status != MatchStatusNormalized.CANCELLED
                    && status != MatchStatusNormalized.POSTPONED
                    && status != MatchStatusNormalized.ABANDONED
                    && status != MatchStatusNormalized.SUSPENDED;
        }
    }

    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public ParticipantScoreDTO calculateScoreForPrediction(Long predictionId) {
        if (predictionId == null) return null;
        Prediction pred = predictionRepository.findById(predictionId).orElse(null);
        if (pred == null) return null;

        boolean pichichiActive = pred.getEdition() != null && pred.getEdition().scoresPichichi();
        List<TopScorerDTO> scorers = pichichiActive ? topScorerService.getTopScorers() : Collections.emptyList();
        ParticipantScoreDTO score = scorePrediction(pred, matchPredictionRepository.findByPredictionId(pred.getId()),
                officialResultsService.current(), scorers,
                scoringStrategy.withRules(ScoringRuleSet.effectiveForEdition(pred.getEdition())), new SurvivorContext());
        boolean entryFee = pred.getEdition() != null && pred.getEdition().getLeague() != null
                && pred.getEdition().getLeague().isEntryFee();
        score.setPending(entryFee && !Boolean.TRUE.equals(pred.getPaid()));
        return score;
    }

    /** Puntos del cuadro (si lo tiene, con las reglas de su edición) más los de los pronósticos por partido. */
    private ParticipantScoreDTO scorePrediction(Prediction pred, List<MatchPrediction> matchPreds,
                                                OfficialResultsService.OfficialResults official, List<TopScorerDTO> scorers,
                                                ScoringStrategy strategy, SurvivorContext survivors) {
        PredictionDataDTO participant = pred.getBracketData();
        ParticipantScoreDTO score;
        Edition edition = pred.getEdition();
        boolean bracketEdition = edition != null && edition.isWorldCupBracket();
        if (participant != null && PredictableBracket.applies(edition)) {
            score = customBracketScoringService.score(pred);
        } else if (participant != null && bracketEdition) {
            score = calculatePoints(strategy, new CalculationContext(participant, official.bracket(), official.groupPoints(),
                    official.orderedTeamsPerGroup(), official.bestThirds(), scorers, official.roundOf16(),
                    official.quarterFinals(), official.semiFinals(), official.finalists(), official.champion()));
            score.setThirdPlaceMatch(participant.getThirdPlaceMatch());
            score.setThirdPlaceWinner(participant.getThirdPlaceWinner());
        } else {
            score = emptyScore();
        }

        int matchPoints = 0;
        if (edition != null && edition.getPoolFormat() == com.porra.mundial.model.PoolFormat.SURVIVOR) {
            SurvivorRules.Standing standing = survivors.standing(edition,
                    pred.getUser() != null ? pred.getUser().getId() : null, pred.getCreatedAt(), matchPreds);
            matchPoints = standing.survived() * SurvivorRules.Settings.of(edition).roundPoints();
            score.setEliminated(standing.eliminated());
            if (matchPoints > 0) {
                score.getLog().add(ParticipantScoreDTO.LogEntry.builder()
                        .stage("matchday")
                        .amount(matchPoints)
                        .msg("Jornadas superadas: " + standing.survived())
                        .build());
            }
            matchPreds = List.of();
        }
        for (MatchPrediction mp : matchPreds) {
            if (mp.getPointsAwarded() != null && mp.getPointsAwarded() > 0) {
                matchPoints += mp.getPointsAwarded();
                score.getLog().add(ParticipantScoreDTO.LogEntry.builder()
                        .stage("matchday")
                        .amount(mp.getPointsAwarded())
                        .msg(mp.getScoringDetails() != null ? mp.getScoringDetails() : ("Acierto en partido (+ " + mp.getPointsAwarded() + " pts)"))
                        .build());
            }
        }
        score.setMatchPoints(matchPoints);
        score.setTotal(score.getTotal() + matchPoints);
        score.setId(pred.getId());
        score.setUserId(pred.getUser() != null ? pred.getUser().getId() : null);
        score.setName(com.porra.mundial.util.TextSanitizer.fixParticipantName(pred.getParticipantName()));
        score.setPredictionName(pred.getPredictionName());
        score.setAvatarUrl(pred.getUser() != null ? pred.getUser().getAvatarUrl() : null);
        return score;
    }

    /**
     * Situación de cada porra superviviente con todo el calendario de su competición, para contar
     * también las jornadas sin elegir. Carga cada calendario y cada fecha de entrada una sola vez.
     */
    private final class SurvivorContext {
        private final Map<Long, List<Match>> calendars = new HashMap<>();
        private final java.time.Instant now = java.time.Instant.now();

        SurvivorRules.Standing standing(Edition edition, Long userId, java.time.Instant fallbackStart,
                                        List<MatchPrediction> picks) {
            Long competitionId = edition.getCompetition() != null ? edition.getCompetition().getId() : null;
            List<Match> calendar = competitionId == null ? List.of()
                    : calendars.computeIfAbsent(competitionId, matchRepository::findByCompetitionId);
            java.time.Instant startAt = fallbackStart;
            if (userId != null && edition.getLeague() != null && edition.getLeague().getId() != null) {
                startAt = membershipRepository.findById(new Membership.MembershipId(userId, edition.getLeague().getId()))
                        .map(Membership::getJoinedAt)
                        .orElse(fallbackStart);
            }
            return SurvivorRules.standing(picks, calendar, startAt, now, SurvivorRules.Settings.of(edition));
        }
    }

    private static ParticipantScoreDTO emptyScore() {
        return ParticipantScoreDTO.builder()
                .r1(0).r32(0).r16(0).qf(0).sf(0).finals(0).scorer(0).matchPoints(0).total(0)
                .log(new ArrayList<>())
                .exactMatches(new HashMap<>())
                .passedTeams(new HashMap<>())
                .build();
    }

    private static ParticipantScoreDTO calculatePoints(ScoringStrategy strategy, CalculationContext ctx) {
        ParticipantScoreDTO score = emptyScore();
        strategy.evaluateScores(score, ctx);

        int total = score.getR1() + score.getR32() + score.getR16() + score.getQf() + score.getSf() + score.getFinals() + score.getScorer();
        score.setTotal(total);

        return score;
    }
}
