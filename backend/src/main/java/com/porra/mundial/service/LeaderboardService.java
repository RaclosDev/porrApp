package com.porra.mundial.service;

import com.porra.mundial.dto.PredictionDataDTO;
import com.porra.mundial.dto.MatchdayPointsDTO;
import com.porra.mundial.dto.ParticipantScoreDTO;
import com.porra.mundial.dto.TopScorerDTO;
import com.porra.mundial.model.Edition;
import com.porra.mundial.model.Prediction;
import com.porra.mundial.model.GroupStanding;
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
import com.porra.mundial.scoring.ScoringStrategy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Servicio de Clasificacion (Leaderboard).
 * Orquesta la clasificacion general o de grupo recuperando datos oficiales y delegando
 * el calculo matematico en la ScoringStrategy configurada, integrando tambien los puntos de jornadas.
 * Soporta materializacion de puntuaciones para evitar N+1 queries.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class LeaderboardService {

    private final PredictionRepository predictionRepository;
    private final StandingsService standingsService;
    private final TopScorerService topScorerService;
    private final MatchRepository matchRepository;
    private final KnockoutBracketService knockoutBracketService;
    private final ScoringStrategy scoringStrategy;
    private final MatchPredictionRepository matchPredictionRepository;
    private final MembershipRepository membershipRepository;
    private final EditionRepository editionRepository;

    /**
     * @param groupId ID del grupo a consultar.
     * @return El ranking ordenado de participantes con todos sus desgloses de puntos.
     */
    /** Clasificación: más puntos, luego más puntos por partido, luego nombre. */
    private static final Comparator<ParticipantScoreDTO> LEADERBOARD_ORDER = Comparator
            .comparingInt(ParticipantScoreDTO::getTotal).reversed()
            .thenComparing(Comparator.comparingInt(ParticipantScoreDTO::getMatchPoints).reversed())
            .thenComparing(score -> score.getName() != null ? score.getName() : "", String.CASE_INSENSITIVE_ORDER);

    /** Mejores terceros: puntos, diferencia de goles, goles a favor, fair play y nombre. */
    private static final Comparator<GroupStanding> THIRD_PLACE_ORDER = Comparator
            .comparingInt((GroupStanding gs) -> gs.getPoints() != null ? gs.getPoints() : 0).reversed()
            .thenComparing(Comparator.comparingInt((GroupStanding gs) -> gs.getGoalDiff() != null ? gs.getGoalDiff() : 0).reversed())
            .thenComparing(Comparator.comparingInt((GroupStanding gs) -> gs.getGoalsFor() != null ? gs.getGoalsFor() : 0).reversed())
            .thenComparing(Comparator.comparingInt((GroupStanding gs) -> gs.getFairPlayPoints() != null ? gs.getFairPlayPoints() : 0).reversed())
            .thenComparing(gs -> gs.getTeam().getName());

    @Cacheable(value = "leaderboard", key = "#groupId != null ? #groupId : 0L")
    @org.springframework.transaction.annotation.Transactional
    public List<ParticipantScoreDTO> getLeaderboard(Long groupId) {
        List<Prediction> groupPredictions = groupId != null
                ? predictionRepository.findByEditionLeagueIdWithUserAndEdition(groupId)
                : predictionRepository.findAllWithUserAndEdition();

        boolean allMaterialized = !groupPredictions.isEmpty() && groupPredictions.stream()
                .filter(p -> p.getParticipantName() == null || !p.getParticipantName().equalsIgnoreCase("Admin"))
                .allMatch(p -> p.getScoreCalculatedAt() != null);

        if (allMaterialized) {
            Map<Long, String> membershipPayment = getMembershipPaymentStatus(groupId);
            List<ParticipantScoreDTO> fastLeaderboard = new ArrayList<>(groupPredictions.size());
            for (Prediction pred : groupPredictions) {
                if (pred.getParticipantName() != null && pred.getParticipantName().equalsIgnoreCase("Admin")) continue;

                ParticipantScoreDTO score = ParticipantScoreDTO.builder()
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
                        .log(new ArrayList<>())
                        .exactMatches(new HashMap<>())
                        .passedTeams(new HashMap<>())
                        .build();
                fastLeaderboard.add(score);
            }
            addLeagueMembersWithoutPredictions(groupId, fastLeaderboard);
            fastLeaderboard.sort(LEADERBOARD_ORDER);
            return fastLeaderboard;
        }

        OfficialState official = buildOfficialState();
        boolean pichichiActive = groupPredictions.stream()
                .anyMatch(p -> p.getEdition() == null || p.getEdition().isPichichi());
        List<TopScorerDTO> scorers = pichichiActive ? topScorerService.getTopScorers() : Collections.emptyList();
        Map<Long, String> membershipPayment = getMembershipPaymentStatus(groupId);

        Map<Long, List<MatchPrediction>> matchPredsByPrediction = matchPredictionsByPrediction(groupPredictions);

        List<ParticipantScoreDTO> leaderboard = new ArrayList<>();
        List<Prediction> toUpdate = new ArrayList<>();
        for (Prediction pred : groupPredictions) {
            if (pred.getParticipantName() != null && pred.getParticipantName().equalsIgnoreCase("Admin")) continue;

            List<MatchPrediction> matchPreds = matchPredsByPrediction.getOrDefault(pred.getId(), List.of());
            if (pred.getBracketData() == null && matchPreds.isEmpty()) continue;

            ParticipantScoreDTO score = scorePrediction(pred, matchPreds, official, scorers);
            score.setPending(isPaymentPending(pred, membershipPayment));
            leaderboard.add(score);
            materialize(pred, score);
            toUpdate.add(pred);
        }

        if (!toUpdate.isEmpty()) {
            try {
                predictionRepository.saveAll(toUpdate);
            } catch (Exception e) {
                log.warn("Could not save materialized prediction scores: {}", e.getMessage());
            }
        }

        addLeagueMembersWithoutPredictions(groupId, leaderboard);
        leaderboard.sort(LEADERBOARD_ORDER);
        return leaderboard;
    }

    /** Una sola consulta para los pronósticos por partido de todas las porras de la clasificación. */
    private Map<Long, List<MatchPrediction>> matchPredictionsByPrediction(List<Prediction> predictions) {
        List<Long> ids = predictions.stream().map(Prediction::getId).filter(Objects::nonNull).toList();
        if (ids.isEmpty()) return Map.of();
        return matchPredictionRepository.findWithMatchByPredictionIdIn(ids).stream()
                .collect(Collectors.groupingBy(mp -> mp.getPrediction().getId()));
    }

    private Map<Long, String> getMembershipPaymentStatus(Long groupId) {
        if (groupId == null) return Collections.emptyMap();
        Map<Long, String> statuses = new HashMap<>();
        for (Membership membership : membershipRepository.findByLeagueId(groupId)) {
            if (membership.getUser() == null || membership.getUser().getId() == null) continue;
            statuses.put(membership.getUser().getId(),
                    membership.getPaymentStatus() != null ? membership.getPaymentStatus() : "PENDING");
        }
        return statuses;
    }

    private boolean isPaymentPending(Prediction pred, Map<Long, String> membershipPayment) {
        Long userId = pred.getUser() != null ? pred.getUser().getId() : null;
        if (userId != null) {
            String status = membershipPayment.get(userId);
            if (status != null) return !"PAID".equalsIgnoreCase(status);
        }
        return !Boolean.TRUE.equals(pred.getPaid());
    }

    private void addLeagueMembersWithoutPredictions(Long groupId, List<ParticipantScoreDTO> leaderboard) {
        if (groupId == null) return;

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
        List<Prediction> groupPredictions = groupId != null
                ? predictionRepository.findByEditionLeagueIdWithUserAndEdition(groupId)
                : predictionRepository.findAllWithUserAndEdition();

        Set<Long> participantPredictionIds = groupPredictions.stream()
                .filter(p -> p.getParticipantName() == null || !p.getParticipantName().equalsIgnoreCase("Admin"))
                .map(Prediction::getId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        Edition edition = groupId != null
                ? editionRepository.findByLeagueIdAndStatus(groupId, "ACTIVE").orElse(null)
                : null;

        List<Match> competitionMatches = edition != null && edition.getCompetition() != null
                ? matchRepository.findByCompetitionId(edition.getCompetition().getId())
                : matchRepository.findAll();

        Map<String, MatchdayAccumulator> matchdays = new LinkedHashMap<>();
        competitionMatches.stream()
                .filter(Objects::nonNull)
                .filter(m -> m.getMatchDate() != null)
                .sorted(Comparator.comparing(Match::getMatchDate))
                .forEach(match -> {
                    String label = MatchRound.label(match);
                    if (isUsableMatchdayLabel(label)) {
                        matchdays.computeIfAbsent(label, key -> new MatchdayAccumulator(label, match.getMatchDate()))
                                .addMatch(match);
                    }
                });

        List<MatchPrediction> matchPredictions = groupId != null
                ? matchPredictionRepository.findByPredictionEditionLeagueId(groupId)
                : matchPredictionRepository.findAll();

        for (MatchPrediction matchPrediction : matchPredictions) {
            if (matchPrediction == null
                    || matchPrediction.getPointsAwarded() == null
                    || matchPrediction.getPointsAwarded() <= 0
                    || matchPrediction.getPrediction() == null
                    || matchPrediction.getPrediction().getId() == null
                    || matchPrediction.getMatch() == null
                    || !participantPredictionIds.contains(matchPrediction.getPrediction().getId())) {
                continue;
            }

            String label = MatchRound.label(matchPrediction.getMatch());
            if (!isUsableMatchdayLabel(label)) continue;

            matchdays.computeIfAbsent(label,
                            key -> new MatchdayAccumulator(label, matchPrediction.getMatch().getMatchDate()))
                    .addPoints(matchPrediction.getPrediction().getId(), matchPrediction.getPointsAwarded());
        }

        int currentIndex = -1;
        int index = 0;
        for (MatchdayAccumulator accumulator : matchdays.values()) {
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
        for (MatchdayAccumulator accumulator : matchdays.values()) {
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
        private LocalDateTime date;
        private int matchCount;
        private boolean finished = true;

        private MatchdayAccumulator(String label, LocalDateTime date) {
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

        boolean pichichiActive = pred.getEdition() == null || pred.getEdition().isPichichi();
        List<TopScorerDTO> scorers = pichichiActive ? topScorerService.getTopScorers() : Collections.emptyList();
        ParticipantScoreDTO score = scorePrediction(pred, matchPredictionRepository.findByPredictionId(pred.getId()),
                buildOfficialState(), scorers);
        score.setPending(!Boolean.TRUE.equals(pred.getPaid()));
        return score;
    }

    /**
     * Estado real del torneo contra el que se puntúa: cuadro oficial, puntos y orden de cada grupo,
     * mejores terceros y equipos que han ido superando cada ronda.
     */
    private record OfficialState(
            PredictionDataDTO bracket,
            Map<String, Map<String, Map<String, Integer>>> groupPoints,
            Map<String, List<String>> orderedTeamsPerGroup,
            List<String> bestThirds,
            List<String> roundOf16,
            List<String> quarterFinals,
            List<String> semiFinals,
            List<String> finalists,
            String champion) {
    }

    private OfficialState buildOfficialState() {
        PredictionDataDTO bracket = predictionRepository.findByIsOfficialTrue()
                .map(Prediction::getBracketData)
                .orElseGet(PredictionDataDTO::new);
        knockoutBracketService.enrichPredictionDataWithMatches(bracket);

        List<GroupStanding> allStandings = standingsService.getAllStandings();
        Map<String, List<String>> orderedTeamsPerGroup = new HashMap<>();
        for (GroupStanding gs : allStandings) {
            if (gs.getGroupName() != null && !"-".equals(gs.getGroupName()) && gs.getTeam() != null) {
                orderedTeamsPerGroup.computeIfAbsent(gs.getGroupName().toUpperCase().trim(), k -> new ArrayList<>())
                        .add(gs.getTeam().getName());
            }
        }
        List<String> bestThirds = allStandings.stream()
                .filter(gs -> Integer.valueOf(3).equals(gs.getPosition()) && gs.getTeam() != null)
                .sorted(THIRD_PLACE_ORDER)
                .limit(8)
                .map(gs -> gs.getTeam().getName())
                .collect(Collectors.toList());

        List<Match> knockout = knockoutBracketService.worldCupMatches().stream()
                .filter(this::isKnockoutMatch)
                .collect(Collectors.toList());
        List<String> roundOf16 = winnersOf(knockout, m -> isRound(m.getRound(), "r32", "32", "16avo", "dieciseis"));
        List<String> quarterFinals = winnersOf(knockout, m -> isRound(m.getRound(), "r16", "octav") && !isRound(m.getRound(), "r32", "32"));
        List<String> semiFinals = winnersOf(knockout, m -> isRound(m.getRound(), "qf", "quarter", "cuart"));
        List<String> finalists = winnersOf(knockout, m -> isRound(m.getRound(), "sf", "semi"));
        Match finalMatch = knockout.stream()
                .filter(m -> isRound(m.getRound(), "final") && !isRound(m.getRound(), "semi", "quarter", "third", "tercer", "3rd", "3er"))
                .findFirst().orElse(null);
        Match thirdPlaceMatch = knockout.stream()
                .filter(m -> isRound(m.getRound(), "third", "tercer", "3rd", "3er"))
                .findFirst().orElse(null);

        if (thirdPlaceMatch != null) {
            String thirdWinner = winnerName(thirdPlaceMatch);
            if (bracket.getThirdPlaceWinner() == null && thirdWinner != null) {
                bracket.setThirdPlaceWinner(thirdWinner);
            }
            if ((bracket.getThirdPlaceMatch() == null || bracket.getThirdPlaceMatch().isEmpty())
                    && thirdPlaceMatch.getHomeTeam() != null && thirdPlaceMatch.getAwayTeam() != null) {
                bracket.setThirdPlaceMatch(List.of(thirdPlaceMatch.getHomeTeam().getName(), thirdPlaceMatch.getAwayTeam().getName()));
            }
        }

        return new OfficialState(bracket, standingsService.getOfficialPoints(), orderedTeamsPerGroup, bestThirds,
                roundOf16, quarterFinals, semiFinals, finalists, finalMatch != null ? winnerName(finalMatch) : null);
    }

    /** Puntos del cuadro (si lo tiene) más los de los pronósticos por partido. */
    private ParticipantScoreDTO scorePrediction(Prediction pred, List<MatchPrediction> matchPreds,
                                                OfficialState official, List<TopScorerDTO> scorers) {
        PredictionDataDTO participant = pred.getBracketData();
        ParticipantScoreDTO score;
        if (participant != null) {
            score = calculatePoints(new CalculationContext(participant, official.bracket(), official.groupPoints(),
                    official.orderedTeamsPerGroup(), official.bestThirds(), scorers, official.roundOf16(),
                    official.quarterFinals(), official.semiFinals(), official.finalists(), official.champion()));
            score.setThirdPlaceMatch(participant.getThirdPlaceMatch());
            score.setThirdPlaceWinner(participant.getThirdPlaceWinner());
        } else {
            score = emptyScore();
        }

        int matchPoints = 0;
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

    /** Guarda en el pronóstico su puntuación para que la clasificación no se recalcule en cada petición. */
    private static void materialize(Prediction pred, ParticipantScoreDTO score) {
        pred.setTotalPoints(score.getTotal());
        pred.setR1Points(score.getR1());
        pred.setR32Points(score.getR32());
        pred.setR16Points(score.getR16());
        pred.setQfPoints(score.getQf());
        pred.setSfPoints(score.getSf());
        pred.setFinalsPoints(score.getFinals());
        pred.setScorerPoints(score.getScorer());
        pred.setMatchPoints(score.getMatchPoints());
        pred.setScoreCalculatedAt(java.time.LocalDateTime.now());
    }

    private List<String> winnersOf(List<Match> matches, java.util.function.Predicate<Match> round) {
        return matches.stream()
                .filter(round)
                .sorted(Comparator.comparing(Match::getMatchDate))
                .map(LeaderboardService::winnerName)
                .filter(java.util.Objects::nonNull)
                .collect(Collectors.toList());
    }

    /** Ganador declarado o, en un partido terminado, el que ganó en el marcador. */
    private static String winnerName(Match m) {
        if (m.getWinnerTeam() != null && m.getWinnerTeam().getName() != null) return m.getWinnerTeam().getName();
        if (Boolean.TRUE.equals(m.getFinished()) && m.getHomeScore() != null && m.getAwayScore() != null) {
            if (m.getHomeScore() > m.getAwayScore()) return m.getHomeTeam() != null ? m.getHomeTeam().getName() : null;
            if (m.getAwayScore() > m.getHomeScore()) return m.getAwayTeam() != null ? m.getAwayTeam().getName() : null;
        }
        return null;
    }

    private static ParticipantScoreDTO emptyScore() {
        return ParticipantScoreDTO.builder()
                .r1(0).r32(0).r16(0).qf(0).sf(0).finals(0).scorer(0).matchPoints(0).total(0)
                .log(new ArrayList<>())
                .exactMatches(new HashMap<>())
                .passedTeams(new HashMap<>())
                .build();
    }

    private ParticipantScoreDTO calculatePoints(CalculationContext ctx) {
        ParticipantScoreDTO score = emptyScore();
        scoringStrategy.evaluateScores(score, ctx);

        int total = score.getR1() + score.getR32() + score.getR16() + score.getQf() + score.getSf() + score.getFinals() + score.getScorer();
        score.setTotal(total);

        return score;
    }

    private boolean isRound(String round, String... targets) {
        if (round == null) return false;
        String lower = round.toLowerCase();
        for (String target : targets) {
            if (lower.contains(target.toLowerCase())) return true;
        }
        return false;
    }

    private boolean isKnockoutMatch(Match m) {
        if (m == null) return false;
        if (m.getGroupName() != null && !"-".equals(m.getGroupName()) && !m.getGroupName().trim().isEmpty()) {
            return false;
        }
        String r = m.getRound();
        if (r == null) return false;
        String lower = r.toLowerCase().trim();
        if (lower.equals("group") || lower.startsWith("group") || lower.contains("grupo") || lower.contains("jornada")) {
            return false;
        }
        if (m.getHomeTeam() != null && m.getAwayTeam() != null 
                && m.getHomeTeam().getGroupName() != null && !"-".equals(m.getHomeTeam().getGroupName())
                && m.getHomeTeam().getGroupName().equalsIgnoreCase(m.getAwayTeam().getGroupName())) {
            return false;
        }
        return true;
    }
}
