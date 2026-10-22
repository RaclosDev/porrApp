package com.porra.mundial.service;

import com.porra.mundial.dto.BetDataDTO;
import com.porra.mundial.dto.ParticipantScoreDTO;
import com.porra.mundial.model.Bet;
import com.porra.mundial.model.GroupStanding;
import com.porra.mundial.model.Match;
import com.porra.mundial.repository.BetRepository;
import com.porra.mundial.repository.MatchRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.text.Normalizer;
import java.util.*;
import java.util.stream.Collectors;

/**
 *  Servicio de Clasificación (Leaderboard).
 * Es el motor matemático que enfrenta las apuestas de todos los usuarios
 * contra los resultados reales (la apuesta "official") y asigna puntos.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class LeaderboardService {

    private final BetRepository betRepository;
    private final StandingsService standingsService;
    private final TopScorerService topScorerService;
    private final HashTransitionService hashTransitionService;
    private final MatchRepository matchRepository;
    private final SyncService syncService;

    /**
     * @param groupId ID del grupo a consultar.
     * @return El ranking ordenado de participantes con todos sus desgloses de puntos.
     * Esta función es muy costosa, así que su resultado se cachea hasta que ocurre
     * algo importante que lo invalide (ej: entra un gol).
     */
    @Cacheable(value = "leaderboard", key = "#groupId")
    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public List<ParticipantScoreDTO> getLeaderboard(Long groupId) {
        List<Bet> allBets = betRepository.findAll();
        Bet adminBet = allBets.stream().filter(b -> b.getParticipantName().equalsIgnoreCase("Admin") || (b.getBetName() != null && b.getBetName().equals("official"))).findFirst().orElse(null);
        BetDataDTO officialData = adminBet != null ? hashTransitionService.rebuildBetDataDtoFromTables(adminBet.getId()) : new BetDataDTO();
        syncService.enrichBetDataWithMatches(officialData);

        List<Bet> groupBets = allBets.stream().filter(b -> groupId.equals(b.getGroupId())).collect(Collectors.toList());

        Map<String, Map<String, Map<String, Integer>>> officialPoints = standingsService.getOfficialPoints();
        List<GroupStanding> allStandings = standingsService.getAllStandings();

        List<ParticipantScoreDTO> leaderboard = new ArrayList<>();

        // Group ordered standings for easy lookup
        Map<String, List<String>> orderedTeamsPerGroup = new HashMap<>();
        Map<String, GroupStanding> bestThirds = new HashMap<>(); // To calculate best thirds

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

        // Dynamically build knockout stages from MatchRepository
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

        for (Bet bet : groupBets) {
            if (bet.getParticipantName().equalsIgnoreCase("Admin")) continue;
            BetDataDTO participant = hashTransitionService.rebuildBetDataDtoFromTables(bet.getId());
            if (participant == null) continue;

            CalculationContext ctx = new CalculationContext(participant, officialData, officialPoints, orderedTeamsPerGroup, bestVirtualThirds, allScorers, offOctavos, offQf, offSf, offFinal, offChampion);
            ParticipantScoreDTO score = calculatePoints(ctx);

            score.setId(bet.getId());
            score.setUserId(bet.getUser() != null ? bet.getUser().getId() : null);
            score.setName(bet.getParticipantName());
            score.setBetName(bet.getBetName());
            score.setThirdPlaceMatch(participant.getThirdPlaceMatch());
            score.setThirdPlaceWinner(participant.getThirdPlaceWinner());
            score.setPending(!Boolean.TRUE.equals(bet.getPaid()));
            leaderboard.add(score);
        }

        leaderboard.sort((a, b) -> Integer.compare(b.getTotal(), a.getTotal()));
        return leaderboard;
    }

    /**
     * Calcula los puntos para un usuario individual aplicando todas las reglas de puntuación.
     */
    private ParticipantScoreDTO calculatePoints(CalculationContext ctx) {
        ParticipantScoreDTO score = ParticipantScoreDTO.builder()
                .r1(0).r32(0).r16(0).qf(0).sf(0).finals(0).scorer(0).total(0)
                .log(new ArrayList<>())
                .exactMatches(new HashMap<>())
                .passedTeams(new HashMap<>())
                .build();

        evaluateGroupStage(score, ctx);
        evaluateKnockouts(score, ctx);
        evaluateFinalsAndThirdPlace(score, ctx);
        evaluateTopScorer(score, ctx);

        score.setTotal(score.getR1() + score.getR32() + score.getR16() + score.getQf() + score.getSf() + score.getFinals() + score.getScorer());
        return score;
    }

    /**
     * Reglas de puntuación para fase de grupos. 
     * Da 10 puntos por acertar clasificado, y otros 10 si además aciertas posición.
     */
    private void evaluateGroupStage(ParticipantScoreDTO score, CalculationContext ctx) {
        if (ctx.part().getGroups() == null) return;

        for (String g : ctx.part().getGroups().keySet()) {
            List<String> pTeams = ctx.part().getGroups().get(g);
            List<String> oTeams = (ctx.off() != null && ctx.off().getGroups() != null) ? ctx.off().getGroups().get(g) : null;
            List<String> vTeams = ctx.orderedTeamsPerGroup().get(g);

            String p1 = getSafeTeam(pTeams, 0);
            String p2 = getSafeTeam(pTeams, 1);
            String p3 = getSafeTeam(pTeams, 2);

            String o1 = getSafeTeam(oTeams, 0);
            String o2 = getSafeTeam(oTeams, 1);
            String o3 = getSafeTeam(oTeams, 2);

            String v1 = getSafeTeam(vTeams, 0);
            String v2 = getSafeTeam(vTeams, 1);
            String v3 = getSafeTeam(vTeams, 2);

            String actualO1 = (o1 != null && !o1.contains("º")) ? o1 : v1;
            String actualO2 = (o2 != null && !o2.contains("º")) ? o2 : v2;
            String actualO3 = (o3 != null && !o3.contains("º")) ? o3 : v3;

            boolean p1Played = hasPlayed(p1, ctx.officialPoints(), g);
            boolean p2Played = hasPlayed(p2, ctx.officialPoints(), g);
            boolean p3Played = hasPlayed(p3, ctx.officialPoints(), g);

            boolean p1Passed = isPassed(p1, actualO1, actualO2, ctx.off(), ctx.bestVirtualThirds(), p1Played);
            boolean p2Passed = isPassed(p2, actualO1, actualO2, ctx.off(), ctx.bestVirtualThirds(), p2Played);
            
            boolean p3Selected = ctx.part().getThirds() != null && ctx.part().getThirds().contains(p3);
            boolean p3ActuallyPassed = isPassed(p3, actualO1, actualO2, ctx.off(), ctx.bestVirtualThirds(), p3Played);
            boolean p3Passed = p3Selected && p3ActuallyPassed;

            boolean p1Exact = actualO1 != null && actualO1.equals(p1);
            boolean p2Exact = actualO2 != null && actualO2.equals(p2);
            boolean p3Exact = actualO3 != null && actualO3.equals(p3) && p3Selected && p3ActuallyPassed;

            awardGroupPoints(score, p1, g, "1º", p1Passed, p1Exact);
            awardGroupPoints(score, p2, g, "2º", p2Passed, p2Exact);
            awardGroupPoints(score, p3, g, "Mejor 3º", p3Passed, p3Exact);

            Map<String, Object> exact = new HashMap<>();
            exact.put("1", p1Exact);
            exact.put("2", p2Exact);
            exact.put("3", p3Exact);
            score.getExactMatches().put(g, exact);

            score.getPassedTeams().put(p1, p1Passed);
            score.getPassedTeams().put(p2, p2Passed);
            score.getPassedTeams().put(p3, p3Passed);
        }
    }

    /**
     * Reglas para octavos, cuartos y semis.
     */
    private void evaluateKnockouts(ParticipantScoreDTO score, CalculationContext ctx) {
        checkRound(score, ctx.part().getFlatR16(), ctx.offOctavos(), 25, "r32", "1/16: %s a octavos");
        checkRound(score, ctx.part().getFlatQf(), ctx.offQf(), 30, "r16", "Octavos: %s a cuartos");
        checkRound(score, ctx.part().getFlatSf(), ctx.offSf(), 40, "qf", "Cuartos: %s a semis");
        checkRound(score, ctx.part().getFinalMatch(), ctx.offFinal(), 60, "sf", "Semis: %s a la final");
    }

    /**
     * Reglas para la gran Final.
     */
    private void evaluateFinalsAndThirdPlace(ParticipantScoreDTO score, CalculationContext ctx) {
        if (ctx.part().getChampion() != null && ctx.part().getChampion().equals(ctx.offChampion())) {
            award(score, 200, "finals", "Final: " + ctx.part().getChampion() + " Campeón");
        }
        
        String off2nd = getSecond(ctx.offFinal(), ctx.offChampion());
        String part2nd = getSecond(ctx.part().getFinalMatch(), ctx.part().getChampion());
        if (part2nd != null && part2nd.equals(off2nd)) {
            award(score, 150, "finals", "Final: " + part2nd + " Subcampeón");
        }

        if (ctx.off() != null) {
            if (ctx.part().getThirdPlaceWinner() != null && ctx.part().getThirdPlaceWinner().equals(ctx.off().getThirdPlaceWinner())) {
                award(score, 100, "finals", "3º/4º: " + ctx.part().getThirdPlaceWinner() + " Tercer puesto");
            }
            
            String off4th = getSecond(ctx.off().getThirdPlaceMatch(), ctx.off().getThirdPlaceWinner());
            String part4th = getSecond(ctx.part().getThirdPlaceMatch(), ctx.part().getThirdPlaceWinner());
            if (part4th != null && part4th.equals(off4th)) {
                award(score, 75, "finals", "3º/4º: " + part4th + " Cuarto puesto");
            }
        }
    }

    /**
     * Lógica difusa (Fuzzy matching) para detectar si el usuario acertó el Pichichi.
     * Como lo teclean a mano ("Mbappe", "mbappé", "Kylian Mbape"), hay que perdonar tildes,
     * mayúsculas y permitir que escriban solo apellido.
     */
    private void evaluateTopScorer(ParticipantScoreDTO score, CalculationContext ctx) {
        // Solo contar los puntos del Pichichi si el mundial ha terminado (es decir, ya hay campeón)
        if (ctx.offChampion() == null) {
            return;
        }

        if (ctx.part().getScorer() == null || ctx.part().getScorer().trim().isEmpty()) {
            return;
        }
        
        boolean scorerAwarded = false;
        
        // Automated API data
        if (ctx.allScorers() != null && !ctx.allScorers().isEmpty()) {
            int maxGoals = (int) ctx.allScorers().get(0).get("goals");
            if (maxGoals > 0) {
                List<Map<String, Object>> topScorers = ctx.allScorers().stream()
                        .filter(s -> (int) s.get("goals") == maxGoals)
                        .collect(Collectors.toList());
                
                long validScorersCount = topScorers.size();
                if (validScorersCount > 0) {
                    int points = (int) (100 / validScorersCount);
                    boolean isMatch = topScorers.stream()
                            .anyMatch(s -> isScorerMatch(ctx.part().getScorer(), (String) s.get("name"), (String) s.get("shortName")));
                    
                    if (isMatch) {
                        String msg = validScorersCount > 1 
                                ? "Pichichi: " + ctx.part().getScorer() + " acertado (" + points + " pts repartidos)"
                                : "Pichichi: " + ctx.part().getScorer() + " acertado";
                        award(score, points, "scorer", msg);
                    }
                    scorerAwarded = true;
                }
            }
        }
        
        // Fallback to manual entry
        if (!scorerAwarded && ctx.off() != null && ctx.off().getScorer() != null && !ctx.off().getScorer().trim().isEmpty()) {
            String[] officialScorers = ctx.off().getScorer().split(",");
            long validScorersCount = Arrays.stream(officialScorers)
                    .map(String::trim)
                    .filter(s -> !s.isEmpty())
                    .count();
            
            if (validScorersCount > 0) {
                int points = (int) (100 / validScorersCount);
                boolean isMatch = Arrays.stream(officialScorers)
                        .map(String::trim)
                        .filter(s -> !s.isEmpty())
                        .anyMatch(s -> isScorerMatch(ctx.part().getScorer(), s, s));
                
                if (isMatch) {
                    String msg = validScorersCount > 1 
                            ? "Pichichi: " + ctx.part().getScorer() + " acertado (" + points + " pts repartidos)"
                            : "Pichichi: " + ctx.part().getScorer() + " acertado";
                    award(score, points, "scorer", msg);
                }
            }
        }
    }

    private String getSafeTeam(List<String> teams, int index) {
        return (teams != null && teams.size() > index) ? teams.get(index) : null;
    }

    private void checkRound(ParticipantScoreDTO score, List<String> pTeams, List<String> oTeams, int pts, String stage, String msgTemplate) {
        if (pTeams == null || oTeams == null) return;
        List<String> flatO = oTeams.stream().filter(Objects::nonNull).collect(Collectors.toList());
        for (String t : pTeams) {
            if (t != null && flatO.contains(t)) {
                award(score, pts, stage, String.format(msgTemplate, t));
            }
        }
    }

    private String getSecond(List<String> match, String winner) {
        if (match == null || winner == null) return null;
        return match.stream().filter(t -> t != null && !t.equals(winner)).findFirst().orElse(null);
    }

    private void awardGroupPoints(ParticipantScoreDTO score, String team, String group, String posDesc, boolean passed, boolean exact) {
        if (passed && exact) {
            award(score, 20, "r1", "Grupo " + group + ": " + team + " clasificado en posición exacta (" + posDesc + ")");
        } else {
            if (passed) award(score, 10, "r1", "Grupo " + group + ": " + team + " clasificado a la siguiente fase");
            if (exact) award(score, 10, "r1", "Grupo " + group + ": " + team + " acierto posición exacta (" + posDesc + ")");
        }
    }

    private void award(ParticipantScoreDTO score, int amount, String stage, String msg) {
        switch (stage) {
            case "r1": score.setR1(score.getR1() + amount); break;
            case "r32": score.setR32(score.getR32() + amount); break;
            case "r16": score.setR16(score.getR16() + amount); break;
            case "qf": score.setQf(score.getQf() + amount); break;
            case "sf": score.setSf(score.getSf() + amount); break;
            case "finals": score.setFinals(score.getFinals() + amount); break;
            case "scorer": score.setScorer(score.getScorer() + amount); break;
        }
        score.getLog().add(ParticipantScoreDTO.LogEntry.builder().stage(stage).amount(amount).msg(msg).build());
    }

    private boolean isPassed(String team, String actualO1, String actualO2, BetDataDTO off, List<String> bestVirtualThirds, boolean hasPlayed) {
        if (team == null) return false;
        if (actualO1 != null && actualO1.equals(team)) return true;
        if (actualO2 != null && actualO2.equals(team)) return true;
        if (off != null && off.getThirds() != null && off.getThirds().contains(team)) return true;
        if (bestVirtualThirds.contains(team)) return true;
        
        // Also check if officially in R32 (not strictly needed if actualO1/2 logic holds)
        if (off != null && off.getGroups() != null) {
            for (List<String> gTeams : off.getGroups().values()) {
                if (gTeams.size() > 0 && team.equals(gTeams.get(0))) return true;
                if (gTeams.size() > 1 && team.equals(gTeams.get(1))) return true;
            }
        }
        return false;
    }

    private boolean hasPlayed(String team, Map<String, Map<String, Map<String, Integer>>> officialPoints, String group) {
        if (team == null) return false;
        String safeName = team.replaceAll("[.#$\\[\\]]", "");
        if (officialPoints.containsKey(group) && officialPoints.get(group).containsKey(safeName)) {
            return officialPoints.get(group).get(safeName).getOrDefault("mp", 0) > 0;
        }
        return false;
    }

    private String normalizeStr(String input) {
        if (input == null) return "";
        String normalized = Normalizer.normalize(input, Normalizer.Form.NFD);
        return normalized.replaceAll("\\p{InCombiningDiacriticalMarks}+", "").toLowerCase().trim();
    }

    private boolean isScorerMatch(String userScorer, String apiName, String apiShortName) {
        if (userScorer == null || userScorer.trim().isEmpty()) return false;
        String user = normalizeStr(userScorer);
        String name = normalizeStr(apiName);
        String shortName = normalizeStr(apiShortName);
        
        if (name.equals(user) || shortName.equals(user)) return true;
        if (name.contains(user) || user.contains(name)) return true;
        if (shortName.contains(" ")) {
            String lastName = shortName.substring(shortName.lastIndexOf(" ") + 1);
            if (user.contains(lastName) || lastName.contains(user)) return true;
        }
        
        // Levenshtein distance for typos like "Mbape" instead of "Mbappe"
        if (levenshteinDistance(user, name) <= 2 || levenshteinDistance(user, shortName) <= 2) {
            return true;
        }
        
        if (shortName.contains(" ")) {
            String lastName = shortName.substring(shortName.lastIndexOf(" ") + 1);
            if (levenshteinDistance(user, lastName) <= 2) return true;
        }
        
        return false;
    }

    private int levenshteinDistance(String a, String b) {
        int[] costs = new int[b.length() + 1];
        for (int j = 0; j < costs.length; j++) costs[j] = j;
        for (int i = 1; i <= a.length(); i++) {
            costs[0] = i;
            int nw = i - 1;
            for (int j = 1; j <= b.length(); j++) {
                int cj = Math.min(1 + Math.min(costs[j], costs[j - 1]), a.charAt(i - 1) == b.charAt(j - 1) ? nw : nw + 1);
                nw = costs[j];
                costs[j] = cj;
            }
        }
        return costs[b.length()];
    }

    private boolean isRound(String r, String... keys) {
        if (r == null) return false;
        String lower = r.toLowerCase();
        for (String k : keys) {
            if (lower.equals(k) || lower.contains(k)) return true;
        }
        return false;
    }

    private record CalculationContext(
            BetDataDTO part,
            BetDataDTO off,
            Map<String, Map<String, Map<String, Integer>>> officialPoints,
            Map<String, List<String>> orderedTeamsPerGroup,
            List<String> bestVirtualThirds,
            List<Map<String, Object>> allScorers,
            List<String> offOctavos,
            List<String> offQf,
            List<String> offSf,
            List<String> offFinal,
            String offChampion
    ) {}
}
