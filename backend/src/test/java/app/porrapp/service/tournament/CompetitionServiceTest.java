package app.porrapp.service.tournament;

import app.porrapp.dto.CompetitionDTO;
import app.porrapp.dto.LeagueStandingDTO;
import app.porrapp.exception.BusinessException;
import app.porrapp.model.Competition;
import app.porrapp.model.League;
import app.porrapp.model.Match;
import app.porrapp.model.Team;
import app.porrapp.repository.CompetitionRepository;
import app.porrapp.repository.MatchRepository;
import app.porrapp.sports.EspnNbaDataProvider;
import app.porrapp.sports.EspnSportsDataProvider;
import app.porrapp.sports.TennisDataProvider;
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
    @Mock private EspnNbaDataProvider nba;
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
    void archivedSeasonsAreNotOffered() {
        when(competitions.findAll()).thenReturn(List.of(
                Competition.builder().id(1L).name("LaLiga").externalId("esp.1").season("2025/26")
                        .archivedAt(java.time.Instant.now()).build(),
                Competition.builder().id(2L).name("LaLiga").externalId("esp.1").season("2026/27").build()));

        assertThat(service.findSyncableCompetitions()).extracting(CompetitionDTO::id).containsExactly(2L);
    }

    @Test
    void syncableCompetitionsCarryTheirSport() {
        when(competitions.findAll()).thenReturn(List.of(
                Competition.builder().id(1L).name("LaLiga").externalId("esp.1").build(),
                Competition.builder().id(2L).name("Worlds").externalId("LOL.Worlds").build()));

        assertThat(service.findSyncableCompetitions()).extracting(CompetitionDTO::sport)
                .containsExactly(app.porrapp.model.Sport.FOOTBALL,
                        app.porrapp.model.Sport.LEAGUE_OF_LEGENDS);
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
    void ownBracketsSayWhenTheirBracketLeaguesCanNoLongerBeCreated() {
        Competition worlds = Competition.builder().id(19L).name("Worlds").externalId("lol.worlds").formatType("TOURNAMENT").build();
        when(competitions.findAll()).thenReturn(List.of(worlds,
                Competition.builder().id(1L).name("LaLiga").externalId("esp.1").formatType("LEAGUE").build()));
        java.time.Instant quarter = java.time.Instant.parse("2026-10-29T08:00:00Z");
        when(matches.findByCompetitionId(19L)).thenReturn(List.of(Match.builder().id(5L).competition(worlds).round("qf")
                .homeTeam(Team.builder().id(1L).name("T1").build()).awayTeam(Team.builder().id(2L).name("GEN").build())
                .matchDate(quarter).build()));

        var byName = service.findSyncableCompetitions().stream()
                .collect(java.util.stream.Collectors.toMap(CompetitionDTO::name, dto -> dto));

        assertThat(byName.get("Worlds").bracketClosesAt())
                .containsOnly(java.util.Map.entry(app.porrapp.model.PoolFormat.KNOCKOUTS_ONLY, quarter),
                        java.util.Map.entry(app.porrapp.model.PoolFormat.FULL_BRACKET, quarter));
        assertThat(byName.get("LaLiga").bracketClosesAt()).isEmpty();
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
        assertThat(byName.get("Open de Australia · femenino").sport()).isEqualTo(app.porrapp.model.Sport.TENNIS);
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

    @Test
    void anArchivedSeasonKeepsItsOwnTableInsteadOfTheLiveOne() {
        when(competitions.findById(5L)).thenReturn(Optional.of(Competition.builder().id(5L).externalId("esp.1")
                .season("2025/26").archivedAt(java.time.Instant.now()).build()));
        when(competitions.findById(9L)).thenReturn(Optional.of(Competition.builder().id(9L).externalId("nba.regular")
                .formatType("LEAGUE").season("2025/26").archivedAt(java.time.Instant.now()).build()));
        when(matches.findByCompetitionId(5L)).thenReturn(List.of(result("Betis", "Sevilla", 2, 0)));
        when(matches.findByCompetitionId(9L)).thenReturn(List.of(result("Knicks", "Nets", 110, 98)));

        assertThat(service.getStandings(5L)).extracting(LeagueStandingDTO::getTeamName)
                .containsExactly("Betis", "Sevilla");
        assertThat(service.getStandings(9L)).extracting(LeagueStandingDTO::getTeamName)
                .containsExactly("Knicks", "Nets");

        // La tabla en vivo del proveedor ya es la de la temporada siguiente.
        verifyNoInteractions(espn, nba);
    }

    @Test
    void theNflTableJoinsBothConferencesRankedByWinShare() throws Exception {
        when(competitions.findById(6L)).thenReturn(Optional.of(
                Competition.builder().id(6L).externalId("nfl").build()));
        when(espn.fetchStandings("nfl")).thenReturn(tools.jackson.databind.json.JsonMapper.builder().build().readTree("""
                {"children": [
                  {"name": "AFC", "standings": {"entries": [
                    {"team": {"displayName": "Bills"}, "stats": [{"name": "wins", "value": 6}, {"name": "losses", "value": 3},
                      {"name": "pointDifferential", "value": 40}, {"name": "pointsFor", "value": 230}, {"name": "pointsAgainst", "value": 190}]},
                    {"team": {"displayName": "Jets"}, "stats": [{"name": "wins", "value": 2}, {"name": "losses", "value": 7}]}
                  ]}},
                  {"name": "NFC", "standings": {"entries": [
                    {"team": {"displayName": "Lions"}, "stats": [{"name": "wins", "value": 8}, {"name": "losses", "value": 1}]},
                    {"team": {"displayName": "Giants"}, "stats": [{"name": "wins", "value": 6}, {"name": "losses", "value": 2},
                      {"name": "ties", "value": 1}]}
                  ]}}
                ]}"""));

        List<LeagueStandingDTO> table = service.getStandings(6L);

        assertThat(table).extracting(LeagueStandingDTO::getTeamName).containsExactly("Lions", "Giants", "Bills", "Jets");
        assertThat(table).extracting(LeagueStandingDTO::getRank).containsExactly(1, 2, 3, 4);
        assertThat(table.get(1).getGamesPlayed()).isEqualTo(9);
        assertThat(table.get(1).getTies()).isEqualTo(1);
        assertThat(table.get(2).getPoints()).isEqualTo(6);
        assertThat(table.get(2).getGoalDiff()).isEqualTo(40);
        verifyNoInteractions(matches);
    }

    @Test
    void theNbaTableHasBothConferencesBySeedWithDivisionAndStreak() throws Exception {
        when(competitions.findById(8L)).thenReturn(Optional.of(
                Competition.builder().id(8L).externalId("nba.regular").formatType("LEAGUE").build()));
        when(nba.fetchStandings()).thenReturn(tools.jackson.databind.json.JsonMapper.builder().build().readTree("""
                {"children": [
                  {"name": "Eastern Conference", "children": [
                    {"name": "Atlantic", "standings": {"entries": [
                      {"team": {"displayName": "Brooklyn Nets"}, "stats": [{"name": "wins", "value": 2}, {"name": "losses", "value": 7},
                        {"name": "playoffSeed", "value": 13}, {"name": "streak", "value": -1, "displayValue": "L1"}]},
                      {"team": {"displayName": "New York Knicks", "shortDisplayName": "Knicks"}, "stats": [{"name": "wins", "value": 7}, {"name": "losses", "value": 2},
                        {"name": "playoffSeed", "value": 1}, {"name": "streak", "value": 3, "displayValue": "W3"},
                        {"name": "pointDifferential", "value": 81}]}
                    ]}},
                    {"name": "Central", "standings": {"entries": [
                      {"team": {"displayName": "Indiana Pacers"}, "stats": [{"name": "wins", "value": 3}, {"name": "losses", "value": 7},
                        {"name": "playoffSeed", "value": 11}]}
                    ]}}
                  ]},
                  {"name": "Western Conference", "children": [
                    {"name": "Northwest", "standings": {"entries": [
                      {"team": {"displayName": "Denver Nuggets"}, "stats": [{"name": "wins", "value": 5}, {"name": "losses", "value": 3},
                        {"name": "playoffSeed", "value": 4}]}
                    ]}}
                  ]}
                ]}"""));

        List<LeagueStandingDTO> table = service.getStandings(8L);

        assertThat(table).extracting(LeagueStandingDTO::getTeamName)
                .containsExactly("New York Knicks", "Indiana Pacers", "Brooklyn Nets", "Denver Nuggets");
        assertThat(table).extracting(LeagueStandingDTO::getGroup).containsExactly(
                "Conferencia Este", "Conferencia Este", "Conferencia Este", "Conferencia Oeste");
        assertThat(table).extracting(LeagueStandingDTO::getRank).containsExactly(1, 2, 3, 1);
        assertThat(table).extracting(LeagueStandingDTO::getDivision)
                .containsExactly("Atlántico", "Central", "Atlántico", "Noroeste");
        assertThat(table.get(0).getStreak()).isEqualTo("V3");
        assertThat(table.get(0).getTeamShortName()).isEqualTo("Knicks");
        assertThat(table.get(2).getStreak()).isEqualTo("D1");
        assertThat(table.get(0).getPoints()).isEqualTo(7);
        assertThat(table.get(0).getGamesPlayed()).isEqualTo(9);
        assertThat(table.get(0).getGoalDiff()).isEqualTo(81);
        verifyNoInteractions(espn, matches);
    }

    @Test
    void withoutEspnTheNbaTableIsRankedByWinShare() throws Exception {
        when(competitions.findById(9L)).thenReturn(Optional.of(
                Competition.builder().id(9L).externalId("nba.regular").formatType("LEAGUE").build()));
        when(nba.fetchStandings()).thenThrow(new IllegalStateException("ESPN caído"));
        when(matches.findByCompetitionId(9L)).thenReturn(List.of(
                result("Knicks", "Nets", 110, 98),
                result("Nets", "Pacers", 120, 101),
                result("Knicks", "Pacers", 99, 104)));

        List<LeagueStandingDTO> table = service.getStandings(9L);

        assertThat(table).extracting(LeagueStandingDTO::getRank).containsExactly(1, 2, 3);
        assertThat(table).allSatisfy(row -> assertThat(row.getPoints()).isEqualTo(row.getWins()));
        assertThat(table).extracting(LeagueStandingDTO::getTies).containsOnly(0);
    }

    @Test
    void theNflTableGoesByDivisionWithShortNamesAndPlayoffSeeds() throws Exception {
        when(competitions.findById(6L)).thenReturn(Optional.of(
                Competition.builder().id(6L).externalId("nfl").build()));
        when(espn.fetchStandings("nfl")).thenReturn(json("""
                {"children": [
                  {"name": "National Football Conference", "children": [
                    {"name": "NFC North", "standings": {"entries": [
                      {"team": {"displayName": "Minnesota Vikings", "shortDisplayName": "Vikings"},
                        "stats": [{"name": "wins", "value": 6}, {"name": "losses", "value": 1}, {"name": "playoffSeed", "value": 2}]}
                    ]}}
                  ]},
                  {"name": "American Football Conference", "children": [
                    {"name": "AFC West", "standings": {"entries": [
                      {"team": {"displayName": "Denver Broncos"}, "stats": [{"name": "wins", "value": 6}, {"name": "losses", "value": 2}]}
                    ]}},
                    {"name": "AFC East", "standings": {"entries": [
                      {"team": {"displayName": "New York Jets"}, "stats": [{"name": "wins", "value": 2}, {"name": "losses", "value": 6},
                        {"name": "playoffSeed", "value": 12}]},
                      {"team": {"displayName": "Buffalo Bills", "shortDisplayName": "Bills"}, "stats": [{"name": "wins", "value": 6},
                        {"name": "losses", "value": 1}, {"name": "playoffSeed", "value": 1}, {"name": "pointsFor", "value": 233}]}
                    ]}}
                  ]}
                ]}"""));

        List<LeagueStandingDTO> table = service.getStandings(6L);

        assertThat(table).extracting(LeagueStandingDTO::getGroup)
                .containsExactly("AFC Este", "AFC Este", "AFC Oeste", "NFC Norte");
        assertThat(table).extracting(LeagueStandingDTO::getTeamName)
                .containsExactly("Buffalo Bills", "New York Jets", "Denver Broncos", "Minnesota Vikings");
        assertThat(table).extracting(LeagueStandingDTO::getRank).containsExactly(1, 2, 1, 1);
        assertThat(table.get(0).getTeamShortName()).isEqualTo("Bills");
        assertThat(table.get(0).getPlayoffSeed()).isEqualTo(1);
        assertThat(table.get(0).getGoalsFor()).isEqualTo(233);
        assertThat(table.get(2).getPlayoffSeed()).isNull();
        verifyNoInteractions(matches);
    }

    @Test
    void aKnockoutCupHasNoTable() throws Exception {
        when(competitions.findById(7L)).thenReturn(Optional.of(Competition.builder().id(7L)
                .externalId("esp.copa_del_rey").formatType("TOURNAMENT").build()));
        when(espn.fetchStandings("esp.copa_del_rey")).thenReturn(null);

        assertThat(service.getStandings(7L)).isEmpty();
        verifyNoInteractions(matches);
    }

    @Test
    void everyEspnGroupKeepsItsTitleAndItsOwnRanks() throws Exception {
        when(competitions.findById(8L)).thenReturn(Optional.of(
                Competition.builder().id(8L).externalId("conmebol.libertadores").build()));
        when(espn.fetchStandings("conmebol.libertadores")).thenReturn(json("""
                {"children": [
                  {"name": "Group A", "standings": {"entries": [
                    {"team": {"displayName": "Flamengo"}, "stats": [{"name": "rank", "value": 2}, {"name": "points", "value": 9}]},
                    {"team": {"displayName": "Estudiantes"}, "stats": [{"name": "rank", "value": 1}, {"name": "points", "value": 12}]}
                  ]}},
                  {"name": "Group B", "standings": {"entries": [
                    {"team": {"displayName": "River Plate"}, "stats": [{"name": "rank", "value": 1}, {"name": "points", "value": 13}]},
                    {"team": {"displayName": "Universitario"}, "stats": [{"name": "rank", "value": 2}, {"name": "points", "value": 7}]}
                  ]}}
                ]}"""));

        List<LeagueStandingDTO> table = service.getStandings(8L);

        assertThat(table).extracting(LeagueStandingDTO::getGroup)
                .containsExactly("Grupo A", "Grupo A", "Grupo B", "Grupo B");
        assertThat(table).extracting(LeagueStandingDTO::getTeamName)
                .containsExactly("Estudiantes", "Flamengo", "River Plate", "Universitario");
        assertThat(table).extracting(LeagueStandingDTO::getRank).containsExactly(1, 2, 1, 2);
        verifyNoInteractions(matches);
    }

    @Test
    void aSingleLeaguePhaseHasNoGroupTitle() throws Exception {
        when(competitions.findById(9L)).thenReturn(Optional.of(
                Competition.builder().id(9L).externalId("uefa.champions").build()));
        when(espn.fetchStandings("uefa.champions")).thenReturn(json("""
                {"children": [{"name": "League Phase", "standings": {"entries": [
                  {"team": {"displayName": "Arsenal"}, "stats": [{"name": "rank", "value": 1}, {"name": "points", "value": 12}]},
                  {"team": {"displayName": "Bayern"}, "stats": [{"name": "rank", "value": 2}, {"name": "points", "value": 10}]}
                ]}}]}"""));

        List<LeagueStandingDTO> table = service.getStandings(9L);

        assertThat(table).extracting(LeagueStandingDTO::getTeamName).containsExactly("Arsenal", "Bayern");
        assertThat(table).extracting(LeagueStandingDTO::getGroup).containsOnlyNulls();
    }

    @Test
    void espnGroupNamesAreShownInSpanish() {
        assertThat(CompetitionService.groupTitle("Group H")).isEqualTo("Grupo H");
        assertThat(CompetitionService.groupTitle("Eastern Conference")).isEqualTo("Conferencia Este");
        assertThat(CompetitionService.groupTitle("Western Conference")).isEqualTo("Conferencia Oeste");
        assertThat(CompetitionService.groupTitle("Apertura")).isEqualTo("Apertura");
    }

    @Test
    void theLolTableSplitsPlayInAndSwissByWinLossAndLeavesOutTheKnockouts() {
        when(competitions.findById(10L)).thenReturn(Optional.of(
                Competition.builder().id(10L).externalId("lol.worlds").formatType("TOURNAMENT").build()));
        when(matches.findByCompetitionId(10L)).thenReturn(List.of(
                series("playin", "KC", "C9", 3, 2),
                series("playin", "MVK", "FURIA", 3, 0),
                series("playin", "KC", "MVK", 3, 0),
                series("group", "T1", "G2", 1, 0),
                series("group", "KC", "T1", 1, 0),
                series("group", "G2", "KC", 0, 1),
                series("group", "T1", "G2", 2, 1),
                series("qf", "KC", "T1", 3, 1),
                Match.builder().round("group").homeTeam(team("G2")).awayTeam(team("KC")).build()));

        List<LeagueStandingDTO> table = service.getStandings(10L);

        assertThat(table).extracting(LeagueStandingDTO::getGroup).containsExactly(
                "Play-in", "Play-in", "Play-in", "Play-in", "Fase suiza", "Fase suiza", "Fase suiza");
        assertThat(table).extracting(LeagueStandingDTO::getTeamName)
                .containsExactly("KC", "MVK", "C9", "FURIA", "KC", "T1", "G2");
        assertThat(table).extracting(row -> row.getWins() + "-" + row.getLosses())
                .containsExactly("2-0", "1-1", "0-1", "0-1", "2-0", "2-1", "0-3");
        assertThat(table).extracting(LeagueStandingDTO::getRank).containsExactly(1, 2, 3, 4, 1, 2, 3);
        // Sin puntos de fútbol: los puntos son las victorias y nunca hay empates.
        assertThat(table).allSatisfy(row -> {
            assertThat(row.getPoints()).isEqualTo(row.getWins());
            assertThat(row.getTies()).isZero();
        });
        verifyNoInteractions(espn);
    }

    private static Match series(String round, String home, String away, int homeGames, int awayGames) {
        Match match = result(home, away, homeGames, awayGames);
        match.setRound(round);
        return match;
    }

    private static tools.jackson.databind.JsonNode json(String body) {
        return tools.jackson.databind.json.JsonMapper.builder().build().readTree(body);
    }

    private static Match result(String home, String away, int homeGoals, int awayGoals) {
        return Match.builder().homeTeam(team(home)).awayTeam(team(away))
                .homeScore(homeGoals).awayScore(awayGoals).finished(true).build();
    }

    private static Team team(String name) {
        return Team.builder().name(name).build();
    }
}
