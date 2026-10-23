package com.porra.mundial.scoring;

import com.porra.mundial.dto.PredictionDataDTO;
import com.porra.mundial.dto.ParticipantScoreDTO;
import org.springframework.stereotype.Component;

import java.text.Normalizer;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Reglas de puntuacion oficiales para la Copa Mundial de la FIFA 2026 (formato 48 equipos).
 * Incluye fase de grupos (10 pts por pasar, 10 por posicion exacta), dieciseisavos (25 pts),
 * octavos (30 pts), cuartos (40 pts), semifinales (60 pts), final, tercer puesto y pichichi.
 */
@Component
public class WorldCup2026ScoringStrategy implements ScoringStrategy {

    private final ScoringRuleSet rules;

    public WorldCup2026ScoringStrategy() {
        this(ScoringRuleSet.defaultWorldCup2026());
    }

    public WorldCup2026ScoringStrategy(ScoringRuleSet rules) {
        this.rules = rules != null ? rules : ScoringRuleSet.defaultWorldCup2026();
    }

    public ScoringRuleSet getRules() {
        return rules;
    }

    @Override
    public void evaluateScores(ParticipantScoreDTO score, CalculationContext ctx) {
        evaluateGroupStage(score, ctx);
        evaluateKnockouts(score, ctx);
        evaluateFinalsAndThirdPlace(score, ctx);
        evaluateTopScorer(score, ctx);
    }

    private void evaluateGroupStage(ParticipantScoreDTO score, CalculationContext ctx) {
        if (ctx.part().getGroups() == null) return;

        for (String g : ctx.part().getGroups().keySet()) {
            List<String> pTeams = ctx.part().getGroups().get(g);
            List<String> oTeams = (ctx.off() != null && ctx.off().getGroups() != null) ? ctx.off().getGroups().get(g) : null;
            List<String> vTeams = ctx.orderedTeamsPerGroup() != null ? ctx.orderedTeamsPerGroup().get(g) : null;

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

    private void evaluateKnockouts(ParticipantScoreDTO score, CalculationContext ctx) {
        checkRound(score, ctx.part().getFlatR16(), ctx.offOctavos(), rules.getRoundOf32Points(), "r32", "1/16: %s a octavos");
        checkRound(score, ctx.part().getFlatQf(), ctx.offQf(), rules.getRoundOf16Points(), "r16", "Octavos: %s a cuartos");
        checkRound(score, ctx.part().getFlatSf(), ctx.offSf(), rules.getQuarterFinalPoints(), "qf", "Cuartos: %s a semis");
        checkRound(score, ctx.part().getFinalMatch(), ctx.offFinal(), rules.getSemiFinalPoints(), "sf", "Semis: %s a la final");
    }

    private void evaluateFinalsAndThirdPlace(ParticipantScoreDTO score, CalculationContext ctx) {
        if (ctx.part().getChampion() != null && ctx.part().getChampion().equals(ctx.offChampion())) {
            award(score, rules.getChampionPoints(), "finals", "Final: " + ctx.part().getChampion() + " Campeón");
        }

        String off2nd = getSecond(ctx.offFinal(), ctx.offChampion());
        String part2nd = getSecond(ctx.part().getFinalMatch(), ctx.part().getChampion());
        if (part2nd != null && part2nd.equals(off2nd)) {
            award(score, rules.getRunnerUpPoints(), "finals", "Final: " + part2nd + " Subcampeón");
        }

        if (ctx.off() != null) {
            if (ctx.part().getThirdPlaceWinner() != null && ctx.part().getThirdPlaceWinner().equals(ctx.off().getThirdPlaceWinner())) {
                award(score, rules.getThirdPlacePoints(), "finals", "3º/4º: " + ctx.part().getThirdPlaceWinner() + " Tercer puesto");
            }

            String off4th = getSecond(ctx.off().getThirdPlaceMatch(), ctx.off().getThirdPlaceWinner());
            String part4th = getSecond(ctx.part().getThirdPlaceMatch(), ctx.part().getThirdPlaceWinner());
            if (part4th != null && part4th.equals(off4th)) {
                award(score, rules.getFourthPlacePoints(), "finals", "3º/4º: " + part4th + " Cuarto puesto");
            }
        }
    }

    private void evaluateTopScorer(ParticipantScoreDTO score, CalculationContext ctx) {
        if (ctx.offChampion() == null) {
            return;
        }

        if (ctx.part().getScorer() == null || ctx.part().getScorer().trim().isEmpty()) {
            return;
        }

        boolean scorerAwarded = false;

        if (ctx.allScorers() != null && !ctx.allScorers().isEmpty()) {
            int maxGoals = (int) ctx.allScorers().get(0).get("goals");
            if (maxGoals > 0) {
                List<Map<String, Object>> topScorers = ctx.allScorers().stream()
                        .filter(s -> (int) s.get("goals") == maxGoals)
                        .collect(Collectors.toList());

                long validScorersCount = topScorers.size();
                if (validScorersCount > 0) {
                    int points = (int) (rules.getTopScorerPoints() / validScorersCount);
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

        if (!scorerAwarded && ctx.off() != null && ctx.off().getScorer() != null && !ctx.off().getScorer().trim().isEmpty()) {
            String[] officialScorers = ctx.off().getScorer().split(",");
            long validScorersCount = Arrays.stream(officialScorers)
                    .map(String::trim)
                    .filter(s -> !s.isEmpty())
                    .count();

            if (validScorersCount > 0) {
                int points = (int) (rules.getTopScorerPoints() / validScorersCount);
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

    private void checkRound(ParticipantScoreDTO score, List<String> pTeams, Collection<String> oTeams, int pts, String stage, String msgTemplate) {
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
            int total = rules.getGroupQualifierPoints() + rules.getGroupExactPositionPoints();
            award(score, total, "r1", "Grupo " + group + ": " + team + " clasificado en posición exacta (" + posDesc + ")");
        } else {
            if (passed) award(score, rules.getGroupQualifierPoints(), "r1", "Grupo " + group + ": " + team + " clasificado a la siguiente fase");
            if (exact) award(score, rules.getGroupExactPositionPoints(), "r1", "Grupo " + group + ": " + team + " acierto posición exacta (" + posDesc + ")");
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

    private boolean isPassed(String team, String actualO1, String actualO2, PredictionDataDTO off, List<String> bestVirtualThirds, boolean hasPlayed) {
        if (team == null) return false;
        if (actualO1 != null && actualO1.equals(team)) return true;
        if (actualO2 != null && actualO2.equals(team)) return true;
        if (off != null && off.getThirds() != null && off.getThirds().contains(team)) return true;
        if (bestVirtualThirds != null && bestVirtualThirds.contains(team)) return true;

        if (off != null && off.getGroups() != null) {
            for (List<String> gTeams : off.getGroups().values()) {
                if (!gTeams.isEmpty() && team.equals(gTeams.get(0))) return true;
                if (gTeams.size() > 1 && team.equals(gTeams.get(1))) return true;
            }
        }
        return false;
    }

    private boolean hasPlayed(String team, Map<String, Map<String, Map<String, Integer>>> officialPoints, String group) {
        if (team == null || officialPoints == null) return false;
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
}
