package com.porra.mundial.service;

import com.porra.mundial.dto.PredictionDataDTO;
import com.porra.mundial.dto.TopScorerDTO;
import com.porra.mundial.model.GroupStanding;
import com.porra.mundial.model.Match;
import com.porra.mundial.model.Team;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.TreeMap;
import java.util.function.Predicate;
import java.util.stream.Collectors;

/**
 * Resultados reales del Mundial contra los que se puntúan los cuadros: clasificación de grupos,
 * mejores terceros, cruces y ganadores de cada ronda, podio y máximos goleadores.
 * <p>
 * Todo sale de los partidos que sincroniza ESPN y de la clasificación que se calcula con ellos;
 * no hay ningún pronóstico "oficial" que mantener a mano.
 */
@Service
@RequiredArgsConstructor
public class OfficialResultsService {

    /** Mejores terceros: puntos, diferencia de goles, goles a favor, fair play y nombre. */
    private static final Comparator<GroupStanding> THIRD_PLACE_ORDER = Comparator
            .comparingInt((GroupStanding gs) -> gs.getPoints() != null ? gs.getPoints() : 0).reversed()
            .thenComparing(Comparator.comparingInt((GroupStanding gs) -> gs.getGoalDiff() != null ? gs.getGoalDiff() : 0).reversed())
            .thenComparing(Comparator.comparingInt((GroupStanding gs) -> gs.getGoalsFor() != null ? gs.getGoalsFor() : 0).reversed())
            .thenComparing(Comparator.comparingInt((GroupStanding gs) -> gs.getFairPlayPoints() != null ? gs.getFairPlayPoints() : 0).reversed())
            .thenComparing(gs -> gs.getTeam().getName());

    private static final Predicate<Match> ROUND_OF_32 = m -> isRound(m.getRound(), "r32", "32", "16avo", "dieciseis");
    private static final Predicate<Match> ROUND_OF_16 = m -> isRound(m.getRound(), "r16", "octav") && !isRound(m.getRound(), "r32", "32");
    private static final Predicate<Match> QUARTER_FINALS = m -> isRound(m.getRound(), "qf", "quarter", "cuart");
    private static final Predicate<Match> SEMI_FINALS = m -> isRound(m.getRound(), "sf", "semi");
    private static final Predicate<Match> FINAL = m -> isRound(m.getRound(), "final")
            && !isRound(m.getRound(), "semi", "quarter", "third", "tercer", "3rd", "3er");
    private static final Predicate<Match> THIRD_PLACE = m -> isRound(m.getRound(), "third", "tercer", "3rd", "3er");

    private final StandingsService standingsService;
    private final KnockoutBracketService knockoutBracketService;
    private final TopScorerService topScorerService;

    /**
     * Estado real del torneo. {@code bracket} tiene la misma forma que el cuadro de un participante;
     * el resto son las listas que usa la puntuación.
     */
    public record OfficialResults(
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

    /** Cuadro oficial con la forma de un pronóstico, para el visor y las estadísticas. */
    public PredictionDataDTO officialBracket() {
        return current().bracket();
    }

    public OfficialResults current() {
        List<GroupStanding> standings = standingsService.getAllStandings();
        Map<String, List<String>> orderedTeamsPerGroup = new TreeMap<>();
        for (GroupStanding gs : standings) {
            if (gs.getGroupName() != null && !"-".equals(gs.getGroupName()) && gs.getTeam() != null) {
                orderedTeamsPerGroup.computeIfAbsent(gs.getGroupName().toUpperCase().trim(), k -> new ArrayList<>())
                        .add(gs.getTeam().getName());
            }
        }
        List<String> bestThirds = standings.stream()
                .filter(gs -> Integer.valueOf(3).equals(gs.getPosition()) && gs.getTeam() != null)
                .sorted(THIRD_PLACE_ORDER)
                .limit(8)
                .map(gs -> gs.getTeam().getName())
                .collect(Collectors.toList());

        List<Match> knockout = knockoutBracketService.worldCupMatches().stream()
                .filter(OfficialResultsService::isKnockoutMatch)
                .sorted(Comparator.comparing(Match::getMatchDate, Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
        Match finalMatch = knockout.stream().filter(FINAL).findFirst().orElse(null);

        PredictionDataDTO bracket = new PredictionDataDTO();
        bracket.setGroups(orderedTeamsPerGroup);
        bracket.setThirds(bestThirds);
        bracket.setR32(pairings(knockout, ROUND_OF_32));
        bracket.setR16(pairings(knockout, ROUND_OF_16));
        bracket.setQf(pairings(knockout, QUARTER_FINALS));
        bracket.setSf(pairings(knockout, SEMI_FINALS));
        bracket.setScorer(topScorerNames(topScorerService.getTopScorers()));
        // Final, campeón y tercer puesto, incluido el cruce cuando solo se conocen las semifinales.
        knockoutBracketService.enrichPredictionDataWithMatches(bracket);
        Match thirdPlaceMatch = knockout.stream().filter(THIRD_PLACE).findFirst().orElse(null);
        if (thirdPlaceMatch != null) {
            if (bracket.getThirdPlaceWinner() == null) {
                bracket.setThirdPlaceWinner(winnerName(thirdPlaceMatch));
            }
            if ((bracket.getThirdPlaceMatch() == null || bracket.getThirdPlaceMatch().isEmpty())
                    && thirdPlaceMatch.getHomeTeam() != null && thirdPlaceMatch.getAwayTeam() != null) {
                bracket.setThirdPlaceMatch(List.of(thirdPlaceMatch.getHomeTeam().getName(), thirdPlaceMatch.getAwayTeam().getName()));
            }
        }

        return new OfficialResults(bracket, standingsService.getOfficialPoints(), orderedTeamsPerGroup, bestThirds,
                winnersOf(knockout, ROUND_OF_32), winnersOf(knockout, ROUND_OF_16),
                winnersOf(knockout, QUARTER_FINALS), winnersOf(knockout, SEMI_FINALS),
                finalMatch != null ? winnerName(finalMatch) : null);
    }

    /** Cruces de una ronda con los equipos reales; un hueco aún sin decidir queda a null. */
    private static List<List<String>> pairings(List<Match> knockout, Predicate<Match> round) {
        return knockout.stream()
                .filter(round)
                .map(m -> Arrays.asList(realName(m.getHomeTeam()), realName(m.getAwayTeam())))
                .filter(pair -> pair.stream().anyMatch(Objects::nonNull))
                .collect(Collectors.toList());
    }

    /** Los empatados en cabeza, separados por comas; null si aún no hay goles. */
    private static String topScorerNames(List<TopScorerDTO> scorers) {
        if (scorers == null || scorers.isEmpty() || scorers.get(0).goals() <= 0) return null;
        int maxGoals = scorers.get(0).goals();
        return scorers.stream()
                .filter(s -> s.goals() == maxGoals)
                .map(TopScorerDTO::name)
                .collect(Collectors.joining(", "));
    }

    private static List<String> winnersOf(List<Match> knockout, Predicate<Match> round) {
        return knockout.stream()
                .filter(round)
                .map(OfficialResultsService::winnerName)
                .filter(Objects::nonNull)
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

    private static String realName(Team team) {
        return Team.isPlaceholder(team) ? null : team.getName();
    }

    private static boolean isRound(String round, String... targets) {
        if (round == null) return false;
        String lower = round.toLowerCase();
        for (String target : targets) {
            if (lower.contains(target.toLowerCase())) return true;
        }
        return false;
    }

    private static boolean isKnockoutMatch(Match m) {
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
        return m.getHomeTeam() == null || m.getAwayTeam() == null
                || m.getHomeTeam().getGroupName() == null || "-".equals(m.getHomeTeam().getGroupName())
                || !m.getHomeTeam().getGroupName().equalsIgnoreCase(m.getAwayTeam().getGroupName());
    }
}
