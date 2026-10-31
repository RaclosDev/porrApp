package com.porra.mundial.scoring;

import com.porra.mundial.dto.PredictionDataDTO;
import com.porra.mundial.dto.ParticipantScoreDTO;
import com.porra.mundial.dto.TopScorerDTO;
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
    public ScoringStrategy withRules(ScoringRuleSet rules) {
        return new WorldCup2026ScoringStrategy(rules);
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
        if (rules == null || rules.getTopScorerPoints() <= 0) {
            return;
        }
        if (ctx.offChampion() == null) {
            return;
        }

        if (ctx.part().getScorer() == null || ctx.part().getScorer().trim().isEmpty()) {
            return;
        }

        boolean scorerAwarded = false;

        if (ctx.allScorers() != null && !ctx.allScorers().isEmpty()) {
            int maxGoals = ctx.allScorers().get(0).goals();
            if (maxGoals > 0) {
                List<TopScorerDTO> topScorers = ctx.allScorers().stream()
                        .filter(s -> s.goals() == maxGoals)
                        .collect(Collectors.toList());

                long validScorersCount = topScorers.size();
                if (validScorersCount > 0) {
                    int points = (int) (rules.getTopScorerPoints() / validScorersCount);
                    List<ScorerName> knownScorers = ScorerName.of(ctx.allScorers());
                    boolean isMatch = topScorers.stream()
                            .anyMatch(s -> isScorerMatch(ctx.part().getScorer(), new ScorerName(s.name(), s.shortName()), knownScorers));

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
                List<ScorerName> knownScorers = Arrays.stream(officialScorers)
                        .map(String::trim)
                        .filter(s -> !s.isEmpty())
                        .map(s -> new ScorerName(s, s))
                        .toList();
                boolean isMatch = knownScorers.stream()
                        .anyMatch(s -> isScorerMatch(ctx.part().getScorer(), s, knownScorers));

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

    /** Nombre de un goleador: el completo y el corto con el que lo muestra ESPN ("K. Mbappé"). */
    private record ScorerName(String name, String shortName) {
        static List<ScorerName> of(List<TopScorerDTO> scorers) {
            return scorers == null ? List.of() : scorers.stream().map(s -> new ScorerName(s.name(), s.shortName())).toList();
        }
    }

    /**
     * Formas normalizadas con las que se puede escribir a un goleador.
     *
     * @param full     nombre completo
     * @param exact    nombre completo, nombre corto e "inicial apellido"
     * @param surnames lo que va tras el nombre de pila y la última palabra; un nombre de una sola palabra es su apellido
     * @param initial  inicial del nombre de pila
     */
    private record PlayerForms(String full, Set<String> exact, Set<String> surnames, String initial) {
        static PlayerForms of(ScorerName scorer) {
            String full = normalizeName(scorer.name());
            String[] tokens = full.split(" ");
            Set<String> exact = new HashSet<>();
            Set<String> surnames = new HashSet<>();
            exact.add(full);
            String shortName = normalizeName(scorer.shortName());
            if (!shortName.isEmpty()) exact.add(shortName);
            if (tokens.length > 1) {
                String afterFirstName = String.join(" ", Arrays.copyOfRange(tokens, 1, tokens.length));
                String lastName = tokens[tokens.length - 1];
                surnames.add(afterFirstName);
                surnames.add(lastName);
                exact.add(tokens[0].charAt(0) + " " + afterFirstName);
                exact.add(tokens[0].charAt(0) + " " + lastName);
            } else {
                surnames.add(full);
            }
            return new PlayerForms(full, exact, surnames, full.isEmpty() ? "" : full.substring(0, 1));
        }
    }

    /**
     * Si el pichichi que escribió el participante es este goleador. El texto se identifica con un único jugador
     * de entre todos los goleadores conocidos y solo cuenta si es este: así "Sergio Ramos" nunca da por bueno a
     * "Gonçalo Ramos". Admite tildes y mayúsculas, el nombre completo, el corto ("K. Mbappé"), "Inicial. Apellido",
     * pequeñas erratas y el apellido solo, siempre que ningún otro goleador encaje igual.
     */
    private static boolean isScorerMatch(String userScorer, ScorerName scorer, List<ScorerName> knownScorers) {
        String user = normalizeName(userScorer);
        if (user.isEmpty()) return false;
        PlayerForms target = PlayerForms.of(scorer);
        if (target.full().isEmpty()) return false;

        Map<String, PlayerForms> players = new LinkedHashMap<>();
        players.put(target.full(), target);
        for (ScorerName known : knownScorers) {
            PlayerForms forms = PlayerForms.of(known);
            if (!forms.full().isEmpty()) players.putIfAbsent(forms.full(), forms);
        }
        PlayerForms chosen = resolveScorer(user, new ArrayList<>(players.values()));
        return chosen != null && chosen.full().equals(target.full());
    }

    /** El goleador al que se refiere el texto, o null si no encaja con ninguno o encaja con más de uno. */
    private static PlayerForms resolveScorer(String user, List<PlayerForms> players) {
        List<PlayerForms> exact = players.stream().filter(p -> p.exact().contains(user)).toList();
        if (!exact.isEmpty()) return onlyOne(exact);

        String[] tokens = user.split(" ");
        if (tokens.length == 2 && tokens[0].length() == 1) {
            // "K. Mbape": la inicial tiene que coincidir; el apellido admite erratas.
            return onlyOne(players.stream()
                    .filter(p -> p.initial().equals(tokens[0]) && p.surnames().stream().anyMatch(s -> isTypoOf(tokens[1], s)))
                    .toList());
        }

        List<PlayerForms> bySurname = players.stream()
                .filter(p -> p.surnames().stream().anyMatch(s -> isTypoOf(user, s)))
                .toList();
        if (!bySurname.isEmpty()) return onlyOne(bySurname);

        // Nombre completo con erratas: el más parecido, si lo es claramente.
        PlayerForms closest = null;
        int bestDistance = Integer.MAX_VALUE;
        boolean tied = false;
        for (PlayerForms p : players) {
            int distance = levenshteinDistance(user, p.full());
            if (distance < bestDistance) {
                closest = p;
                bestDistance = distance;
                tied = false;
            } else if (distance == bestDistance) {
                tied = true;
            }
        }
        return closest != null && !tied && bestDistance <= maxTypos(closest.full()) ? closest : null;
    }

    private static PlayerForms onlyOne(List<PlayerForms> candidates) {
        return candidates.size() == 1 ? candidates.get(0) : null;
    }

    /** Si {@code text} es {@code expected} o lo escribe con alguna errata, según su longitud. */
    private static boolean isTypoOf(String text, String expected) {
        return levenshteinDistance(text, expected) <= maxTypos(expected);
    }

    /** Erratas admitidas: ninguna en nombres de menos de 5 letras, una hasta 11 y dos a partir de 12. */
    private static int maxTypos(String expected) {
        int length = expected.length();
        if (length < 5) return 0;
        return length < 12 ? 1 : 2;
    }

    /** Minúsculas, sin tildes ni signos, espacios simples y "Jr" como "Junior". */
    private static String normalizeName(String input) {
        if (input == null) return "";
        String text = Normalizer.normalize(input, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .toLowerCase(Locale.ROOT)
                .replace("ø", "o").replace("æ", "ae").replace("œ", "oe").replace("ß", "ss")
                .replace("đ", "d").replace("ł", "l").replace("ı", "i")
                .replaceAll("['’`´]", "")
                .replaceAll("[^a-z0-9]+", " ")
                .trim();
        if (text.isEmpty()) return "";
        return Arrays.stream(text.split(" "))
                .map(token -> token.equals("jr") ? "junior" : token)
                .collect(Collectors.joining(" "));
    }

    private static int levenshteinDistance(String a, String b) {
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
