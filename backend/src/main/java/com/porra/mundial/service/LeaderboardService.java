package com.porra.mundial.service;

import com.porra.mundial.dto.PredictionDataDTO;
import com.porra.mundial.dto.ParticipantScoreDTO;
import com.porra.mundial.model.Prediction;
import com.porra.mundial.model.GroupStanding;
import com.porra.mundial.model.Match;
import com.porra.mundial.model.MatchPrediction;
import com.porra.mundial.repository.PredictionRepository;
import com.porra.mundial.repository.MatchRepository;
import com.porra.mundial.repository.MatchPredictionRepository;
import com.porra.mundial.scoring.CalculationContext;
import com.porra.mundial.scoring.ScoringStrategy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

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
    private final SyncService syncService;
    private final ScoringStrategy scoringStrategy;
    private final MatchPredictionRepository matchPredictionRepository;

    /**
     * @param groupId ID del grupo a consultar.
     * @return El ranking ordenado de participantes con todos sus desgloses de puntos.
     */
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
            List<ParticipantScoreDTO> fastLeaderboard = new ArrayList<>(groupPredictions.size());
            for (Prediction pred : groupPredictions) {
                if (pred.getParticipantName() != null && pred.getParticipantName().equalsIgnoreCase("Admin")) continue;

                ParticipantScoreDTO score = ParticipantScoreDTO.builder()
                        .id(pred.getId())
                        .userId(pred.getUser() != null ? pred.getUser().getId() : null)
                        .name(pred.getParticipantName())
                        .betName(pred.getBetName())
                        .pending(!Boolean.TRUE.equals(pred.getPaid()))
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
            fastLeaderboard.sort((a, b) -> {
                if (a.getTotal() != b.getTotal()) return Integer.compare(b.getTotal(), a.getTotal());
                if (a.getMatchPoints() != b.getMatchPoints()) return Integer.compare(b.getMatchPoints(), a.getMatchPoints());
                String nameA = a.getName() != null ? a.getName() : "";
                String nameB = b.getName() != null ? b.getName() : "";
                return nameA.compareToIgnoreCase(nameB);
            });
            return fastLeaderboard;
        }

        Prediction adminPrediction = predictionRepository.findByIsOfficialTrue()
                .or(() -> predictionRepository.findByName("official"))
                .or(() -> predictionRepository.findAll().stream()
                        .filter(b -> (b.getName() != null && b.getName().equalsIgnoreCase("official"))
                                || (b.getParticipantName() != null && b.getParticipantName().equalsIgnoreCase("Admin")))
                        .findFirst())
                .orElse(null);
        PredictionDataDTO officialData = (adminPrediction != null && adminPrediction.getBracketData() != null) ? adminPrediction.getBracketData() : new PredictionDataDTO();
        syncService.enrichBetDataWithMatches(officialData);

        Map<String, Map<String, Map<String, Integer>>> officialPoints = standingsService.getOfficialPoints();
        List<GroupStanding> allStandings = standingsService.getAllStandings();

        List<ParticipantScoreDTO> leaderboard = new ArrayList<>();
        Map<String, List<String>> orderedTeamsPerGroup = new HashMap<>();

        for (GroupStanding gs : allStandings) {
            if (gs.getGroupName() != null && !"-".equals(gs.getGroupName()) && gs.getTeam() != null) {
                orderedTeamsPerGroup.computeIfAbsent(gs.getGroupName().toUpperCase().trim(), k -> new ArrayList<>())
                        .add(gs.getTeam().getName());
            }
        }

        List<GroupStanding> allThirds = allStandings.stream()
                .filter(gs -> Integer.valueOf(3).equals(gs.getPosition()) && gs.getTeam() != null)
                .sorted((a, b) -> {
                    int ptsA = a.getPoints() != null ? a.getPoints() : 0;
                    int ptsB = b.getPoints() != null ? b.getPoints() : 0;
                    if (ptsA != ptsB) return Integer.compare(ptsB, ptsA);

                    int gdA = a.getGoalDiff() != null ? a.getGoalDiff() : 0;
                    int gdB = b.getGoalDiff() != null ? b.getGoalDiff() : 0;
                    if (gdA != gdB) return Integer.compare(gdB, gdA);

                    int gfA = a.getGoalsFor() != null ? a.getGoalsFor() : 0;
                    int gfB = b.getGoalsFor() != null ? b.getGoalsFor() : 0;
                    if (gfA != gfB) return Integer.compare(gfB, gfA);

                    int fpA = a.getFairPlayPoints() != null ? a.getFairPlayPoints() : 0;
                    int fpB = b.getFairPlayPoints() != null ? b.getFairPlayPoints() : 0;
                    if (fpA != fpB) return Integer.compare(fpB, fpA);

                    return a.getTeam().getName().compareTo(b.getTeam().getName());
                })
                .collect(Collectors.toList());

        List<String> bestVirtualThirds = allThirds.stream().limit(8).map(gs -> gs.getTeam().getName()).collect(Collectors.toList());
        boolean pichichiActive = groupPredictions.stream()
                .anyMatch(p -> p.getEdition() == null || p.getEdition().isPichichi());
        List<Map<String, Object>> allScorers = pichichiActive ? topScorerService.getTopScorers() : Collections.emptyList();

        List<Match> allMatches = matchRepository.findAll();
        List<Match> r32Matches = allMatches.stream().filter(m -> isRound(m.getRound(), "r32", "32", "16avo", "dieciseis")).sorted(Comparator.comparing(Match::getMatchDate)).collect(Collectors.toList());
        List<Match> r16Matches = allMatches.stream().filter(m -> isRound(m.getRound(), "r16", "octav") && !isRound(m.getRound(), "r32", "32")).sorted(Comparator.comparing(Match::getMatchDate)).collect(Collectors.toList());
        List<Match> qfMatches = allMatches.stream().filter(m -> isRound(m.getRound(), "qf", "quarter", "cuart")).sorted(Comparator.comparing(Match::getMatchDate)).collect(Collectors.toList());
        List<Match> sfMatches = allMatches.stream().filter(m -> isRound(m.getRound(), "sf", "semi")).sorted(Comparator.comparing(Match::getMatchDate)).collect(Collectors.toList());
        List<Match> finalMatchDb = allMatches.stream().filter(m -> isRound(m.getRound(), "final") && !isRound(m.getRound(), "semi", "quarter")).collect(Collectors.toList());

        java.util.function.Function<Match, String> getWinner = (m) -> {
            if (m == null) return null;
            if (m.getWinnerTeam() != null && m.getWinnerTeam().getName() != null) return m.getWinnerTeam().getName();
            if (Boolean.TRUE.equals(m.getFinished()) && m.getHomeScore() != null && m.getAwayScore() != null) {
                if (m.getHomeScore() > m.getAwayScore()) return m.getHomeTeam() != null ? m.getHomeTeam().getName() : null;
                if (m.getAwayScore() > m.getHomeScore()) return m.getAwayTeam() != null ? m.getAwayTeam().getName() : null;
            }
            return null;
        };

        List<String> offOctavos = new ArrayList<>();
        for (Match m : r32Matches) {
            String w = getWinner.apply(m);
            if (w != null) offOctavos.add(w);
        }

        List<String> offQf = new ArrayList<>();
        for (Match m : r16Matches) {
            String w = getWinner.apply(m);
            if (w != null) offQf.add(w);
        }

        List<String> offSf = new ArrayList<>();
        for (Match m : qfMatches) {
            String w = getWinner.apply(m);
            if (w != null) offSf.add(w);
        }

        List<String> offFinal = new ArrayList<>();
        for (Match m : sfMatches) {
            String w = getWinner.apply(m);
            if (w != null) offFinal.add(w);
        }

        String offChampion = finalMatchDb.isEmpty() ? null : getWinner.apply(finalMatchDb.get(0));

        List<Prediction> toUpdate = new ArrayList<>();
        for (Prediction pred : groupPredictions) {
            if (pred.getParticipantName() != null && pred.getParticipantName().equalsIgnoreCase("Admin")) continue;

            PredictionDataDTO participant = pred.getBracketData();
            List<MatchPrediction> matchPreds = matchPredictionRepository.findByPredictionId(pred.getId());

            if (participant == null && (matchPreds == null || matchPreds.isEmpty())) {
                continue;
            }

            ParticipantScoreDTO score;
            if (participant != null) {
                CalculationContext ctx = new CalculationContext(participant, officialData, officialPoints, orderedTeamsPerGroup, bestVirtualThirds, allScorers, offOctavos, offQf, offSf, offFinal, offChampion);
                score = calculatePoints(ctx);
                score.setThirdPlaceMatch(participant.getThirdPlaceMatch());
                score.setThirdPlaceWinner(participant.getThirdPlaceWinner());
            } else {
                score = ParticipantScoreDTO.builder()
                        .r1(0).r32(0).r16(0).qf(0).sf(0).finals(0).scorer(0).matchPoints(0).total(0)
                        .log(new ArrayList<>())
                        .exactMatches(new HashMap<>())
                        .passedTeams(new HashMap<>())
                        .build();
            }

            int matchPoints = 0;
            if (matchPreds != null) {
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
            }
            score.setMatchPoints(matchPoints);
            score.setTotal(score.getTotal() + matchPoints);

            score.setId(pred.getId());
            score.setUserId(pred.getUser() != null ? pred.getUser().getId() : null);
            score.setName(pred.getParticipantName());
            score.setBetName(pred.getBetName());
            score.setPending(!Boolean.TRUE.equals(pred.getPaid()));
            leaderboard.add(score);

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
            toUpdate.add(pred);
        }

        if (!toUpdate.isEmpty()) {
            try {
                predictionRepository.saveAll(toUpdate);
            } catch (Exception e) {
                log.warn("Could not save materialized prediction scores: {}", e.getMessage());
            }
        }

        leaderboard.sort((a, b) -> {
            if (a.getTotal() != b.getTotal()) return Integer.compare(b.getTotal(), a.getTotal());
            if (a.getMatchPoints() != b.getMatchPoints()) return Integer.compare(b.getMatchPoints(), a.getMatchPoints());
            String nameA = a.getName() != null ? a.getName() : "";
            String nameB = b.getName() != null ? b.getName() : "";
            return nameA.compareToIgnoreCase(nameB);
        });
        return leaderboard;
    }

    @org.springframework.cache.annotation.CacheEvict(value = "leaderboard", allEntries = true)
    @org.springframework.transaction.annotation.Transactional
    public void invalidateScores() {
        predictionRepository.invalidateAllScores();
    }

    private String sanitizeCsvField(String value) {
        if (value == null || value.isBlank()) return "\"\"";
        String clean = value.replace("\"", "\"\"");
        if (clean.startsWith("=") || clean.startsWith("+") || clean.startsWith("-") || clean.startsWith("@") || clean.startsWith("\t") || clean.startsWith("\r")) {
            clean = "'" + clean;
        }
        return "\"" + clean + "\"";
    }

    public String exportLeaderboardCsv(Long groupId) {
        List<ParticipantScoreDTO> leaderboard = getLeaderboard(groupId);
        StringBuilder sb = new StringBuilder();
        sb.append("Posicion,Participante,Nombre Porra,Puntos Totales,Jornadas,Fase Grupos,R32,Octavos,Cuartos,Semifinales,Final,Pichichi,Estado Pago\n");
        int pos = 1;
        for (ParticipantScoreDTO score : leaderboard) {
            String pName = sanitizeCsvField(score.getName());
            String bName = sanitizeCsvField(score.getBetName());
            String status = score.isPending() ? "Pendiente" : "Pagado";
            sb.append(pos++).append(",")
              .append(pName).append(",")
              .append(bName).append(",")
              .append(score.getTotal()).append(",")
              .append(score.getMatchPoints()).append(",")
              .append(score.getR1()).append(",")
              .append(score.getR32()).append(",")
              .append(score.getR16()).append(",")
              .append(score.getQf()).append(",")
              .append(score.getSf()).append(",")
              .append(score.getFinals()).append(",")
              .append(score.getScorer()).append(",")
              .append(status).append("\n");
        }
        return sb.toString();
    }

    private ParticipantScoreDTO calculatePoints(CalculationContext ctx) {
        ParticipantScoreDTO score = ParticipantScoreDTO.builder()
                .r1(0).r32(0).r16(0).qf(0).sf(0).finals(0).scorer(0).matchPoints(0).total(0)
                .log(new ArrayList<>())
                .exactMatches(new HashMap<>())
                .passedTeams(new HashMap<>())
                .build();

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
}
