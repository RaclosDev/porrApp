package com.porra.mundial.service;

import com.porra.mundial.dto.PredictionDataDTO;
import com.porra.mundial.dto.TopScorerDTO;
import com.porra.mundial.model.GroupStanding;
import com.porra.mundial.model.Match;
import com.porra.mundial.model.Team;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
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

    private final List<Match> matches = new ArrayList<>();
    private int day = 0;

    @BeforeEach
    void setUp() {
        when(knockoutBracketService.worldCupMatches()).thenReturn(matches);
        when(topScorerService.getTopScorers()).thenReturn(List.of());
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
                .matchDate(LocalDateTime.of(2026, 7, 1, 20, 0).plusDays(day++)).finished(winner != null).build();
        if (winner != null) {
            m.setHomeScore(winner.equals(home) ? 2 : 0);
            m.setAwayScore(winner.equals(home) ? 0 : 2);
        }
        matches.add(m);
        return m;
    }

    @Test
    void groupsFollowTheLiveStandingsAndThirdsAreRanked() {
        when(standingsService.getAllStandings()).thenReturn(List.of(
                standing("A", "México", 1, 9, 5), standing("A", "Corea del Sur", 2, 4, 0),
                standing("A", "Sudáfrica", 3, 4, -1), standing("A", "Chequia", 4, 0, -4),
                standing("B", "Suiza", 1, 7, 3), standing("B", "Canadá", 2, 4, 1),
                standing("B", "Bosnia", 3, 4, 2), standing("B", "Catar", 4, 1, -6)));

        OfficialResultsService.OfficialResults results = service.current();

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

        OfficialResultsService.OfficialResults results = service.current();
        PredictionDataDTO bracket = results.bracket();

        assertThat(bracket.getR32()).containsExactly(List.of("España", "Japón"), List.of("Brasil", "Corea del Sur"));
        assertThat(bracket.getR16()).containsExactly(List.of("España", "Brasil"));
        assertThat(bracket.getQf()).containsExactly(List.of("España", "Alemania"));
        assertThat(bracket.getSf()).containsExactly(List.of("España", "Francia"), List.of("Argentina", "Inglaterra"));
        assertThat(results.roundOf16()).containsExactly("España", "Brasil");
        assertThat(results.quarterFinals()).containsExactly("España");
        assertThat(results.semiFinals()).containsExactly("España");
        assertThat(results.finalists()).containsExactly("España", "Argentina");
        assertThat(results.champion()).isEqualTo("España");
    }

    @Test
    void undecidedSlotsStayEmptyAndUnplayedMatchesAreSkipped() {
        knockout("r16", "España", Team.PLACEHOLDER_NAME, null);
        knockout("r16", Team.PLACEHOLDER_NAME, Team.PLACEHOLDER_NAME, null);

        OfficialResultsService.OfficialResults results = service.current();

        assertThat(results.bracket().getR16()).containsExactly(Arrays.asList("España", null));
        assertThat(results.quarterFinals()).isEmpty();
        assertThat(results.champion()).isNull();
    }

    @Test
    void thirdPlaceComesFromItsMatch() {
        knockout("third", "Francia", "Inglaterra", "Inglaterra");

        PredictionDataDTO bracket = service.officialBracket();

        assertThat(bracket.getThirdPlaceMatch()).containsExactly("Francia", "Inglaterra");
        assertThat(bracket.getThirdPlaceWinner()).isEqualTo("Inglaterra");
    }

    @Test
    void topScorerListsEveryoneTiedAtTheTop() {
        when(topScorerService.getTopScorers()).thenReturn(List.of(
                new TopScorerDTO("Kylian Mbappé", "K. Mbappé", 8, "FW", null, null, null),
                new TopScorerDTO("Harry Kane", "H. Kane", 8, "FW", null, null, null),
                new TopScorerDTO("Lamine Yamal", "L. Yamal", 6, "FW", null, null, null)));

        assertThat(service.officialBracket().getScorer()).isEqualTo("Kylian Mbappé, Harry Kane");
    }

    @Test
    void groupMatchesNeverCountAsKnockout() {
        knockout("group", "España", "Uruguay", "España");

        OfficialResultsService.OfficialResults results = service.current();

        assertThat(results.bracket().getR32()).isEmpty();
        assertThat(results.roundOf16()).isEmpty();
    }
}
