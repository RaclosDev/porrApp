package com.porra.mundial.service.tournament;

import com.porra.mundial.dto.CompetitionDTO;
import com.porra.mundial.dto.LeagueStandingDTO;
import com.porra.mundial.exception.BusinessException;
import com.porra.mundial.model.Competition;
import com.porra.mundial.model.League;
import com.porra.mundial.model.Match;
import com.porra.mundial.model.Team;
import com.porra.mundial.repository.CompetitionRepository;
import com.porra.mundial.repository.MatchRepository;
import com.porra.mundial.sports.EspnSportsDataProvider;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CompetitionServiceTest {

    @Mock private CompetitionRepository competitions;
    @Mock private MatchRepository matches;
    @Mock private EspnSportsDataProvider espn;
    @InjectMocks private CompetitionService service;

    @Test
    void onlyCompetitionsWithAProviderAreSyncableSortedByName() {
        when(competitions.findAll()).thenReturn(List.of(
                Competition.builder().id(1L).name("premier").externalId("eng.1").build(),
                Competition.builder().id(2L).name("Mi copa").externalId(" ").build(),
                Competition.builder().id(3L).name("LaLiga").externalId("esp.1").build()));

        assertThat(service.findSyncableCompetitions()).extracting(CompetitionDTO::name)
                .containsExactly("LaLiga", "premier");
    }

    @Test
    void syncableCompetitionsCarryTheirSport() {
        when(competitions.findAll()).thenReturn(List.of(
                Competition.builder().id(1L).name("LaLiga").externalId("esp.1").build(),
                Competition.builder().id(2L).name("Worlds").externalId("LOL.Worlds").build()));

        assertThat(service.findSyncableCompetitions()).extracting(CompetitionDTO::sport)
                .containsExactly(com.porra.mundial.model.Sport.FOOTBALL,
                        com.porra.mundial.model.Sport.LEAGUE_OF_LEGENDS);
    }

    @Test
    void privateCompetitionsHaveNoPublicStandings() {
        when(competitions.findById(4L)).thenReturn(Optional.of(
                Competition.builder().id(4L).ownerLeague(League.builder().id(1L).build()).build()));

        assertThatThrownBy(() -> service.getStandings(4L)).isInstanceOf(BusinessException.class);
        verifyNoInteractions(espn, matches);
    }

    @Test
    void withoutEspnTheTableComesFromFinishedMatches() throws Exception {
        when(competitions.findById(5L)).thenReturn(Optional.of(
                Competition.builder().id(5L).externalId("esp.1").build()));
        when(espn.fetchStandings("esp.1")).thenThrow(new IllegalStateException("ESPN caído"));
        when(matches.findByCompetitionId(5L)).thenReturn(List.of(
                result("Betis", "Sevilla", 2, 0),
                result("Sevilla", "Osasuna", 1, 1),
                result("Osasuna", "Betis", 0, 0),
                Match.builder().homeTeam(team("Betis")).awayTeam(team("Osasuna")).build()));

        List<LeagueStandingDTO> table = service.getStandings(5L);

        assertThat(table).extracting(LeagueStandingDTO::getTeamName).containsExactly("Betis", "Osasuna", "Sevilla");
        assertThat(table).extracting(LeagueStandingDTO::getRank).containsExactly(1, 2, 3);
        assertThat(table.get(0).getPoints()).isEqualTo(4);
        assertThat(table.get(0).getGoalDiff()).isEqualTo(2);
    }

    private static Match result(String home, String away, int homeGoals, int awayGoals) {
        return Match.builder().homeTeam(team(home)).awayTeam(team(away))
                .homeScore(homeGoals).awayScore(awayGoals).finished(true).build();
    }

    private static Team team(String name) {
        return Team.builder().name(name).build();
    }
}
