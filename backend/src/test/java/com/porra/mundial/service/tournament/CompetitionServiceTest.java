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
import com.porra.mundial.sports.TennisDataProvider;
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
    @Mock private TennisDataProvider tennis;
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
    void marksFinishedCompetitionsAndGroupStages() {
        when(competitions.findAll()).thenReturn(List.of(
                Competition.builder().id(1L).name("Mundial").externalId("fifa.world").build(),
                Competition.builder().id(2L).name("Serie A").externalId("ita.1").build(),
                Competition.builder().id(3L).name("MLS").externalId("usa.1").build()));
        when(matches.calendarStatsByCompetition()).thenReturn(List.of(
                new Object[]{1L, 104L, 0L, 72L},
                new Object[]{2L, 380L, 250L, 0L}));

        var byName = service.findSyncableCompetitions().stream()
                .collect(java.util.stream.Collectors.toMap(CompetitionDTO::name, dto -> dto));

        assertThat(byName.get("Mundial").finished()).isTrue();
        assertThat(byName.get("Mundial").groupStage()).isTrue();
        assertThat(byName.get("Serie A").finished()).isFalse();
        assertThat(byName.get("Serie A").groupStage()).isFalse();
        // Sin partidos importados no se sabe: no se da por terminada ni se descarta la fase de grupos.
        assertThat(byName.get("MLS").finished()).isFalse();
        assertThat(byName.get("MLS").groupStage()).isNull();
    }

    @Test
    void aTennisTournamentIsFinishedWhenItsLastEditionIsOverEvenWithoutMatches() throws Exception {
        java.time.Instant now = java.time.Instant.now();
        when(competitions.findAll()).thenReturn(List.of(
                Competition.builder().id(1L).name("Roland Garros · masculino").externalId("tennis.atp.172").build(),
                Competition.builder().id(2L).name("Masters de París").externalId("tennis.atp.13").build(),
                Competition.builder().id(3L).name("Open de Australia · femenino").externalId("tennis.wta.154").build()));
        when(tennis.supports(org.mockito.ArgumentMatchers.anyString())).thenReturn(true);
        when(tennis.currentEdition("tennis.atp.172")).thenReturn(new TennisDataProvider.Edition("172-2026",
                now.minus(java.time.Duration.ofDays(40)), now.minus(java.time.Duration.ofDays(20))));
        when(tennis.currentEdition("tennis.atp.13")).thenReturn(new TennisDataProvider.Edition("13-2027",
                now.plus(java.time.Duration.ofDays(20)), now.plus(java.time.Duration.ofDays(30))));
        when(tennis.currentEdition("tennis.wta.154")).thenThrow(new IllegalStateException("ESPN caído"));
        when(matches.calendarStatsByCompetition()).thenReturn(List.<Object[]>of(new Object[]{2L, 15L, 0L, 0L}));

        var byName = service.findSyncableCompetitions().stream()
                .collect(java.util.stream.Collectors.toMap(CompetitionDTO::name, dto -> dto));

        assertThat(byName.get("Roland Garros · masculino").finished()).isTrue();
        assertThat(byName.get("Roland Garros · masculino").tennis().setsToWin()).isEqualTo(3);
        // La próxima edición ya está publicada: se puede crear una liga aunque la de este año acabara.
        assertThat(byName.get("Masters de París").finished()).isFalse();
        assertThat(byName.get("Masters de París").tennis().level()).isEqualTo("MASTERS_1000");
        assertThat(byName.get("Masters de París").tennis().startDate()).isNotNull();
        assertThat(byName.get("Open de Australia · femenino").finished()).isFalse();
        assertThat(byName.get("Open de Australia · femenino").tennis().draw()).isEqualTo("WOMEN");
        assertThat(byName.get("Open de Australia · femenino").sport()).isEqualTo(com.porra.mundial.model.Sport.TENNIS);
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
