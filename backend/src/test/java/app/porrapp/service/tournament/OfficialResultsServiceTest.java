package app.porrapp.service.tournament;

import app.porrapp.dto.PredictionDataDTO;
import app.porrapp.dto.TopScorerDTO;
import app.porrapp.model.Competition;
import app.porrapp.model.GroupStanding;
import app.porrapp.model.Match;
import app.porrapp.model.Team;
import app.porrapp.util.AppTime;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OfficialResultsServiceTest {

    @Mock
    private StandingsService standingsService;
    @Mock
    private KnockoutBracketService knockoutBracketService;
    @Mock
    private TopScorerService topScorerService;

    @InjectMocks
    private OfficialResultsService service;

    private final Competition worldCup = Competition.builder().id(2L).name("Mundial")
            .externalId(Competition.WORLD_CUP_EXTERNAL_ID).build();
    private final List<Match> matches = new ArrayList<>();
    private int day = 0;

    @BeforeEach
    void setUp() {
        org.mockito.Mockito.lenient().when(knockoutBracketService.matchesOf(worldCup)).thenReturn(matches);
        org.mockito.Mockito.lenient().when(topScorerService.getTopScorers(worldCup)).thenReturn(List.of());
    }

    private static Team team(String name) {
        return Team.builder().name(name).build();
    }

    private static GroupStanding standing(String group, String team, int position, int points, int goalDiff) {
        return GroupStanding.builder().groupName(group).team(team(team)).position(position)
                .points(points).goalDiff(goalDiff).build();
    }

    /** Partido de eliminatoria ya jugado; {@code winner} null deja el marcador en empate. */
    private Match knockout(String round, String home, String away, String winner) {
        Match m = Match.builder().round(round).homeTeam(team(home)).awayTeam(team(away))
                .matchDate(AppTime.fromLocal(LocalDateTime.of(2026, 7, 1, 20, 0)).plus(day++, ChronoUnit.DAYS)).finished(winner != null).build();
        if (winner != null) {
            m.setHomeScore(winner.equals(home) ? 2 : 0);
            m.setAwayScore(winner.equals(home) ? 0 : 2);
        }
        matches.add(m);
        return m;
    }

    @Test
    void groupsFollowTheLiveStandingsAndThirdsAreRanked() {
        when(standingsService.getStandings(worldCup)).thenReturn(List.of(
                standing("A", "México", 1, 9, 5), standing("A", "Corea del Sur", 2, 4, 0),
                standing("A", "Sudáfrica", 3, 4, -1), standing("A", "Chequia", 4, 0, -4),
                standing("B", "Suiza", 1, 7, 3), standing("B", "Canadá", 2, 4, 1),
                standing("B", "Bosnia", 3, 4, 2), standing("B", "Catar", 4, 1, -6)));

        OfficialResultsService.OfficialResults results = service.current(worldCup);

        assertThat(results.bracket().getGroups().get("A"))
                .containsExactly("México", "Corea del Sur", "Sudáfrica", "Chequia");
        // Mismos puntos: decide la diferencia de goles.
        assertThat(results.bestThirds()).containsExactly("Bosnia", "Sudáfrica");
        assertThat(results.bracket().getThirds()).isEqualTo(results.bestThirds());
    }

    @Test
    void everyRoundListsItsPairingsAndWhoWentThrough() {
        knockout("r32", "España", "Japón", "España");
        knockout("r32", "Brasil", "Corea del Sur", "Brasil");
        knockout("r16", "España", "Brasil", "España");
        knockout("qf", "España", "Alemania", "España");
        knockout("sf", "España", "Francia", "España");
        knockout("sf", "Argentina", "Inglaterra", "Argentina");
        knockout("final", "España", "Argentina", "España");

        OfficialResultsService.OfficialResults results = service.current(worldCup);
        PredictionDataDTO bracket = results.bracket();

        // Ganadores conocidos siguen puntuando aunque falten los grupos que anclan sus ramas.
        assertThat(bracket.getTopologyVersion()).isEqualTo(2);
        assertThat(bracket.getR32()).hasSize(16);
        assertThat(bracket.getR16()).hasSize(8);
        assertThat(bracket.getQf()).hasSize(4);
        assertThat(bracket.getSf()).hasSize(2);
        assertThat(results.roundOf16()).containsExactly("España", "Brasil");
        assertThat(results.quarterFinals()).containsExactly("España");
        assertThat(results.semiFinals()).containsExactly("España");
        assertThat(results.finalists()).containsExactly("España", "Argentina");
        assertThat(results.champion()).isEqualTo("España");
    }

    @Test
    void undecidedSlotsStayEmptyAndUnplayedMatchesAreSkipped() {
        when(standingsService.getStandings(worldCup)).thenReturn(List.of(standing("E", "España", 1, 9, 5)));
        knockout("r32", "España", Team.PLACEHOLDER_NAME, null);
        knockout("r16", "España", Team.PLACEHOLDER_NAME, null);
        knockout("r16", Team.PLACEHOLDER_NAME, Team.PLACEHOLDER_NAME, null);

        OfficialResultsService.OfficialResults results = service.current(worldCup);

        assertThat(results.bracket().getR16()).hasSize(8);
        assertThat(results.bracket().getR16().get(0)).containsExactly("España", null);
        assertThat(results.bracket().getR16().subList(1, 8)).allSatisfy(pair -> assertThat(pair).containsExactly(null, null));
        assertThat(results.quarterFinals()).isEmpty();
        assertThat(results.champion()).isNull();
    }

    @Test
    void thirdPlaceComesFromItsMatch() {
        knockout("third", "Francia", "Inglaterra", "Inglaterra");

        PredictionDataDTO bracket = service.bracket(worldCup);

        // Sin semifinales no se inventa a qué rama pertenece cada participante.
        assertThat(bracket.getThirdPlaceMatch()).containsExactly(null, null);
        assertThat(bracket.getThirdPlaceWinner()).isEqualTo("Inglaterra");
    }

    @Test
    void topScorerListsEveryoneTiedAtTheTop() {
        when(topScorerService.getTopScorers(worldCup)).thenReturn(List.of(
                new TopScorerDTO("Kylian Mbappé", "K. Mbappé", 8, "FW", null, null, null),
                new TopScorerDTO("Harry Kane", "H. Kane", 8, "FW", null, null, null),
                new TopScorerDTO("Lamine Yamal", "L. Yamal", 6, "FW", null, null, null)));

        assertThat(service.bracket(worldCup).getScorer()).isEqualTo("Kylian Mbappé, Harry Kane");
    }

    @Test
    void groupMatchesNeverCountAsKnockout() {
        knockout("group", "España", "Uruguay", "España");

        OfficialResultsService.OfficialResults results = service.current(worldCup);

        assertThat(results.bracket().getR32()).hasSize(16)
                .allSatisfy(pair -> assertThat(pair).containsExactly(null, null));
        assertThat(results.roundOf16()).isEmpty();
    }
    @Test
    void officialRoundsKeepFifaBranchesEvenWhenDatesAndHomeSidesDiffer() {
        List<GroupStanding> groups = new ArrayList<>();
        for (char group = 'A'; group <= 'L'; group++) {
            for (int position = 1; position <= 4; position++) {
                groups.add(standing(String.valueOf(group), "" + group + position, position, 12 - position, 0));
            }
        }
        when(standingsService.getStandings(worldCup)).thenReturn(groups);
        List<List<String>> expected = new ArrayList<>();
        int third = 0;
        for (var slots : app.porrapp.model.TournamentFormat.registered("fifa.world").firstKnockoutRound()) {
            String home = slots.get(0).substring(1) + slots.get(0).charAt(0);
            String away = slots.get(1).startsWith("3") ? "Third" + third++
                    : slots.get(1).substring(1) + slots.get(1).charAt(0);
            expected.add(List.of(home, away));
            knockout("r32", away, home, home);
        }
        for (int i = 0; i < 8; i++) {
            String left = expected.get(i * 2).get(0);
            String right = expected.get(i * 2 + 1).get(0);
            knockout("r16", right, left, left);
        }
        for (int i = 0; i < 4; i++) knockout("qf", expected.get(i * 4 + 2).get(0), expected.get(i * 4).get(0), expected.get(i * 4).get(0));
        for (int i = 0; i < 2; i++) knockout("sf", expected.get(i * 8 + 4).get(0), expected.get(i * 8).get(0), expected.get(i * 8).get(0));
        knockout("final", expected.get(8).get(0), expected.get(0).get(0), expected.get(0).get(0));
        knockout("third", expected.get(12).get(0), expected.get(4).get(0), expected.get(4).get(0));
        java.util.Collections.reverse(matches);
        for (int i = 0; i < matches.size(); i++) matches.get(i).setMatchDate(AppTime.fromLocal(LocalDateTime.of(2026, 7, 1, 20, 0)).plus(i, ChronoUnit.DAYS));

        PredictionDataDTO bracket = service.bracket(worldCup);

        assertThat(bracket.getR32()).isEqualTo(expected);
        assertThat(bracket.getR16()).hasSize(8);
        for (int i = 0; i < 8; i++) {
            assertThat(bracket.getR16().get(i)).containsExactly(expected.get(i * 2).get(0), expected.get(i * 2 + 1).get(0));
        }
        assertThat(bracket.getQf().get(0)).containsExactly("E1", "A2");
        assertThat(bracket.getSf().get(0)).containsExactly("E1", "K2");
        assertThat(bracket.getSf().get(1)).containsExactly("C1", "J1");
        assertThat(bracket.getFinalMatch()).containsExactly("E1", "C1");
        assertThat(bracket.getThirdPlaceMatch()).containsExactly("K2", "J1");
        assertThat(bracket.getChampion()).isEqualTo("E1");
        assertThat(bracket.getThirdPlaceWinner()).isEqualTo("K2");
    }

    @Test
    void provisionalDeclaredWinnerDoesNotAwardOfficialAdvancement() {
        Match match = knockout("r32", "España", "Japón", null);
        match.setWinnerTeam(match.getHomeTeam());
        assertThat(service.current(worldCup).roundOf16()).isEmpty();
    }

    @Test
    void aTournamentThatStartsInTheRoundOfSixteenHasNoEarlierRoundNorThirdPlace() {
        Competition euro = Competition.builder().id(9L).name("Eurocopa").externalId("uefa.euro").build();
        when(knockoutBracketService.matchesOf(euro)).thenReturn(matches);
        when(topScorerService.getTopScorers(euro)).thenReturn(List.of());
        List<GroupStanding> groups = new ArrayList<>();
        for (char group = 'A'; group <= 'F'; group++) {
            for (int position = 1; position <= 4; position++) {
                groups.add(standing(String.valueOf(group), "" + group + position, position, 12 - position,
                        // Los mejores terceros: A, B, D y E.
                        position == 3 && (group == 'C' || group == 'F') ? -5 : 0));
            }
        }
        when(standingsService.getStandings(euro)).thenReturn(groups);
        knockout("r16", "B1", "A3", "B1");
        knockout("r16", "A1", "C2", "A1");
        knockout("r16", "F1", "B3", "F1");
        knockout("r16", "D2", "E2", "D2");
        knockout("r16", "C1", "E3", "C1");
        knockout("r16", "A2", "B2", "A2");
        knockout("r16", "E1", "D3", "E1");
        knockout("r16", "D1", "F2", "D1");
        knockout("qf", "B1", "A1", "B1");
        knockout("qf", "F1", "D2", "F1");
        knockout("qf", "C1", "A2", "C1");
        knockout("qf", "E1", "D1", "E1");
        knockout("sf", "B1", "F1", "B1");
        knockout("sf", "C1", "E1", "C1");
        knockout("final", "B1", "C1", "B1");

        OfficialResultsService.OfficialResults results = service.current(euro);
        PredictionDataDTO bracket = results.bracket();

        assertThat(bracket.getR32()).isNull();
        assertThat(bracket.getThirds()).containsExactlyInAnyOrder("A3", "B3", "D3", "E3");
        assertThat(bracket.getR16()).hasSize(8);
        assertThat(bracket.getR16().get(0)).containsExactly("B1", "A3");
        assertThat(bracket.getR16().get(4)).containsExactly("C1", "E3");
        assertThat(bracket.getQf()).containsExactly(List.of("B1", "A1"), List.of("F1", "D2"),
                List.of("C1", "A2"), List.of("E1", "D1"));
        assertThat(bracket.getSf()).containsExactly(List.of("B1", "F1"), List.of("C1", "E1"));
        assertThat(bracket.getFinalMatch()).containsExactly("B1", "C1");
        assertThat(bracket.getChampion()).isEqualTo("B1");
        assertThat(bracket.getThirdPlaceMatch()).isNull();
        assertThat(bracket.getThirdPlaceWinner()).isNull();
        // Nadie llega a octavos desde una ronda anterior: esa lista es la que puntúa los dieciseisavos.
        assertThat(results.roundOf16()).isEmpty();
        assertThat(results.quarterFinals()).containsExactlyInAnyOrder("B1", "A1", "F1", "D2", "C1", "A2", "E1", "D1");
    }
}
