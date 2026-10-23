package com.porra.mundial.service;

import com.porra.mundial.dto.BetDataDTO;
import com.porra.mundial.dto.ParticipantScoreDTO;
import com.porra.mundial.model.Prediction;
import com.porra.mundial.model.GroupStanding;
import com.porra.mundial.model.Match;
import com.porra.mundial.repository.PredictionRepository;
import com.porra.mundial.repository.MatchRepository;
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
 * el calculo matematico en la ScoringStrategy configurada.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class LeaderboardService {

    private final PredictionRepository predictionRepository;
    private final StandingsService standingsService;
    private final TopScorerService topScorerService;
    private final PredictionPersistenceService predictionPersistenceService;
    private final MatchRepository matchRepository;
    private final SyncService syncService;
    private final ScoringStrategy scoringStrategy;

    /**
     * @param groupId ID del grupo a consultar.
     * @return El ranking ordenado de participantes con todos sus desgloses de puntos.
     */
    @Cacheable(value = "leaderboard", key = "#groupId")
    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public List<ParticipantScoreDTO> getLeaderboard(Long groupId) {
        Prediction adminPrediction = predictionRepository.findByIsOfficialTrue()
                .or(() -> predictionRepository.findByName("official"))
                .or(() -> predictionRepository.findAll().stream()
                        .filter(b -> (b.getName() != null && b.getName().equalsIgnoreCase("official"))
                                || (b.getParticipantName() != null && b.getParticipantName().equalsIgnoreCase("Admin")))
                        .findFirst())
                .orElse(null);
        BetDataDTO officialData = adminPrediction != null ? predictionPersistenceService.rebuildBetDataDtoFromTables(adminPrediction.getId()) : new BetDataDTO();
        syncService.enrichBetDataWithMatches(officialData);

        List<Prediction> groupPredictions = groupId != null ? predictionRepository.findByEditionLeagueId(groupId) : predictionRepository.findAll();

        Map<String, Map<String, Map<String, Integer>>> officialPoints = standingsService.getOfficialPoints();
        List<GroupStanding> allStandings = standingsService.getAllStandings();

        List<ParticipantScoreDTO> leaderboard = new ArrayList<>();

        Map<String, List<String>> orderedTeamsPerGroup = new HashMap<>();

        for (GroupStanding gs : allStandings) {
            if (gs.getGroupName() == null || "-".equals(gs.getGroupName()) || gs.getTeam() == null || "Por definir".equalsIgnoreCase(gs.getTeam().getName())) continue;
            orderedTeamsPerGroup.computeIfAbsent(gs.getGroupName().toUpperCase().trim(), k -> new ArrayList<>()).add(gs.getTeam().getName());
        }

        List<GroupStanding> allThirds = new ArrayList<>();
        for (String group : orderedTeamsPerGroup.keySet()) {
            List<String> teams = orderedTeamsPerGroup.get(group);
            if (teams.size() >= 3) {
                String thirdPlaceName = teams.get(2);
                allStandings.stream().filter(gs -> gs.getTeam().getName().equals(thirdPlaceName)).findFirst().ifPresent(allThirds::add);
            }
        }

        allThirds.sort((a, b) -> {
            if (a.getPoints() != b.getPoints()) return Integer.compare(b.getPoints(), a.getPoints());
            if (a.getGoalDiff() != b.getGoalDiff()) return Integer.compare(b.getGoalDiff(), a.getGoalDiff());
            return Integer.compare(b.getGoalsFor(), a.getGoalsFor());
        });

        List<String> bestVirtualThirds = allThirds.stream().limit(8).map(gs -> gs.getTeam().getName()).collect(Collectors.toList());
        List<Map<String, Object>> allScorers = topScorerService.getTopScorers();

        List<Match> allMatches = matchRepository.findAll();
        List<Match> r16Matches = allMatches.stream().filter(m -> isRound(m.getRound(), "r16", "octav")).sorted(Comparator.comparing(Match::getMatchDate)).collect(Collectors.toList());
        List<Match> qfMatches = allMatches.stream().filter(m -> isRound(m.getRound(), "qf", "quarter", "cuart")).sorted(Comparator.comparing(Match::getMatchDate)).collect(Collectors.toList());
        List<Match> sfMatches = allMatches.stream().filter(m -> isRound(m.getRound(), "sf", "semi")).sorted(Comparator.comparing(Match::getMatchDate)).collect(Collectors.toList());
        List<Match> finalMatchDb = allMatches.stream().filter(m -> isRound(m.getRound(), "final") && !isRound(m.getRound(), "semi", "quarter", "octav")).collect(Collectors.toList());

        java.util.function.Function<Match, String> getWinner = (m) -> {
            if (m == null) return null;
            if (m.getWinnerTeam() != null) return m.getWinnerTeam().getName();
            if (m.getHomeScore() == null || m.getAwayScore() == null) return null;
            if (!Objects.equals(m.getHomeScore(), m.getAwayScore())) {
                if (m.getHomeScore() > m.getAwayScore()) return m.getHomeTeam() != null ? m.getHomeTeam().getName() : null;
                if (m.getAwayScore() > m.getHomeScore()) return m.getAwayTeam() != null ? m.getAwayTeam().getName() : null;
            }
            return null;
        };

        List<String> offOctavos = new ArrayList<>();
        if (r16Matches.size() >= 16) {
            for (int i = 0; i < 16; i++) {
                String w = getWinner.apply(r16Matches.get(i));
                if (w != null) offOctavos.add(w);
            }
        }

        List<String> offQf = new ArrayList<>();
        if (r16Matches.size() >= 24) {
            for (int i = 16; i < 24; i++) {
                String w = getWinner.apply(r16Matches.get(i));
                if (w != null) offQf.add(w);
            }
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

        for (Prediction pred : groupPredictions) {
            if (pred.getParticipantName() != null && pred.getParticipantName().equalsIgnoreCase("Admin")) continue;
            BetDataDTO participant = predictionPersistenceService.rebuildBetDataDtoFromTables(pred.getId());
            if (participant == null) continue;

            CalculationContext ctx = new CalculationContext(participant, officialData, officialPoints, orderedTeamsPerGroup, bestVirtualThirds, allScorers, offOctavos, offQf, offSf, offFinal, offChampion);
            ParticipantScoreDTO score = calculatePoints(ctx);

            score.setId(pred.getId());
            score.setUserId(pred.getUser() != null ? pred.getUser().getId() : null);
            score.setName(pred.getParticipantName());
            score.setBetName(pred.getBetName());
            score.setThirdPlaceMatch(participant.getThirdPlaceMatch());
            score.setThirdPlaceWinner(participant.getThirdPlaceWinner());
            score.setPending(!Boolean.TRUE.equals(pred.getPaid()));
            leaderboard.add(score);
        }

        leaderboard.sort((a, b) -> Integer.compare(b.getTotal(), a.getTotal()));
        return leaderboard;
    }

    public String exportLeaderboardCsv(Long groupId) {
        List<ParticipantScoreDTO> leaderboard = getLeaderboard(groupId);
        StringBuilder sb = new StringBuilder();
        sb.append("Posicion,Participante,Nombre Porra,Puntos Totales,Fase Grupos,R32,Octavos,Cuartos,Semifinales,Final,Pichichi,Estado Pago\n");
        int pos = 1;
        for (ParticipantScoreDTO score : leaderboard) {
            String pName = score.getName() != null ? score.getName().replace(",", " ") : "";
            String bName = score.getBetName() != null ? score.getBetName().replace(",", " ") : "";
            String status = score.isPending() ? "Pendiente" : "Pagado";
            sb.append(pos++).append(",")
              .append(pName).append(",")
              .append(bName).append(",")
              .append(score.getTotal()).append(",")
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
                .r1(0).r32(0).r16(0).qf(0).sf(0).finals(0).scorer(0).total(0)
                .log(new ArrayList<>())
                .exactMatches(new HashMap<>())
                .passedTeams(new HashMap<>())
                .build();

        scoringStrategy.evaluateScores(score, ctx);

        score.setTotal(score.getR1() + score.getR32() + score.getR16() + score.getQf() + score.getSf() + score.getFinals() + score.getScorer());
        return score;
    }

    private boolean isRound(String r, String... keys) {
        if (r == null) return false;
        String lower = r.toLowerCase();
        for (String k : keys) {
            if (lower.equals(k) || lower.contains(k)) return true;
        }
        return false;
    }
}
