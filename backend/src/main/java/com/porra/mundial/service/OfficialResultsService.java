package com.porra.mundial.service;

import com.porra.mundial.dto.PredictionDataDTO;
import com.porra.mundial.dto.TopScorerDTO;
import com.porra.mundial.model.GroupStanding;
import com.porra.mundial.model.Match;
import com.porra.mundial.model.KnockoutRound;
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

    private static final Predicate<Match> ROUND_OF_32 = round(KnockoutRound.ROUND_OF_32);
    private static final Predicate<Match> ROUND_OF_16 = round(KnockoutRound.ROUND_OF_16);
    private static final Predicate<Match> QUARTER_FINALS = round(KnockoutRound.QUARTER_FINAL);
    private static final Predicate<Match> SEMI_FINALS = round(KnockoutRound.SEMI_FINAL);
    private static final Predicate<Match> FINAL = round(KnockoutRound.FINAL);
    private static final Predicate<Match> THIRD_PLACE = round(KnockoutRound.THIRD_PLACE);

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
        for (GroupStanding gs : standings.stream().sorted(Comparator.comparing(
                GroupStanding::getPosition, Comparator.nullsLast(Comparator.naturalOrder()))).toList()) {
            if (gs.getGroupName() != null && !"-".equals(gs.getGroupName()) && gs.getTeam() != null) {
                orderedTeamsPerGroup.computeIfAbsent(gs.getGroupName().toUpperCase().trim(), k -> new ArrayList<>())
                        .add(gs.getTeam().getName());
            }
        }
        List<String> bestThirds = standings.stream()
                .filter(gs -> Integer.valueOf(3).equals(gs.getPosition()) && gs.getTeam() != null)
                .sorted(GroupTiebreaker.THIRD_PLACE_ORDER)
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
        bracket.setTopologyVersion(2);
        List<Match> firstRound = knockout.stream().filter(ROUND_OF_32).toList();
        List<Match> secondRound = knockout.stream().filter(ROUND_OF_16).toList();
        List<Match> quarters = knockout.stream().filter(QUARTER_FINALS).toList();
        List<Match> semis = knockout.stream().filter(SEMI_FINALS).toList();
        bracket.setR32(OfficialBracketLayout.firstRound(orderedTeamsPerGroup, firstRound));
        bracket.setR16(OfficialBracketLayout.nextRound(bracket.getR32(), secondRound));
        bracket.setQf(OfficialBracketLayout.nextRound(bracket.getR16(), quarters));
        bracket.setSf(OfficialBracketLayout.nextRound(bracket.getQf(), semis));
        bracket.setScorer(topScorerNames(topScorerService.getTopScorers()));
        List<String> finalists = OfficialBracketLayout.semifinalOutcomes(bracket.getSf(), semis, true);
        List<String> thirdPlaceTeams = OfficialBracketLayout.semifinalOutcomes(bracket.getSf(), semis, false);
        List<String> finalPair = OfficialBracketLayout.nextRound(bracket.getSf(),
                knockout.stream().filter(FINAL).toList()).get(0);
        bracket.setFinalMatch(mergeKnown(finalPair, finalists));
        bracket.setChampion(finalMatch != null ? winnerName(finalMatch) : null);
        // Tercer puesto comparte las dos ramas de semifinales, pero recibe sus perdedores.
        List<String> thirdPair = OfficialBracketLayout.nextRound(bracket.getSf(),
                knockout.stream().filter(THIRD_PLACE).toList()).get(0);
        bracket.setThirdPlaceMatch(mergeKnown(thirdPair, thirdPlaceTeams));
        Match thirdPlaceMatch = knockout.stream().filter(THIRD_PLACE).findFirst().orElse(null);
        bracket.setThirdPlaceWinner(thirdPlaceMatch != null ? winnerName(thirdPlaceMatch) : null);

        return new OfficialResults(bracket, standingsService.getOfficialPoints(), orderedTeamsPerGroup, bestThirds,
                winnersOf(knockout, ROUND_OF_32), winnersOf(knockout, ROUND_OF_16),
                winnersOf(knockout, QUARTER_FINALS), winnersOf(knockout, SEMI_FINALS),
                finalMatch != null ? winnerName(finalMatch) : null);
    }

    private static List<String> mergeKnown(List<String> actual, List<String> derived) {
        return Arrays.asList(actual.get(0) != null ? actual.get(0) : derived.get(0),
                actual.get(1) != null ? actual.get(1) : derived.get(1));
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
    private static String winnerName(Match match) {
        return OfficialBracketLayout.name(KnockoutBracketService.winnerOf(match));
    }

    private static Predicate<Match> round(KnockoutRound round) {
        return match -> KnockoutRound.fromLabel(match.getRound()) == round;
    }

    private static boolean isKnockoutMatch(Match match) {
        return KnockoutBracketService.isKnockoutMatch(match);
    }
}
