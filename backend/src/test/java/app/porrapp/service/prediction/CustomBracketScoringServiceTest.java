package app.porrapp.service.prediction;

import app.porrapp.dto.PredictionDataDTO;
import app.porrapp.model.Competition;
import app.porrapp.model.Edition;
import app.porrapp.model.League;
import app.porrapp.model.Match;
import app.porrapp.model.PoolFormat;
import app.porrapp.model.Prediction;
import app.porrapp.model.Team;
import app.porrapp.repository.CompetitionTeamRepository;
import app.porrapp.repository.MatchRepository;
import app.porrapp.repository.TeamRepository;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class CustomBracketScoringServiceTest {
    private final MatchRepository matches = mock(MatchRepository.class);
    private final TeamRepository teams = mock(TeamRepository.class);
    private final CompetitionTeamRepository competitionTeams = mock(CompetitionTeamRepository.class);
    private final CustomBracketScoringService service = new CustomBracketScoringService(matches, teams, competitionTeams);

    @Test
    void scoresOnlyFinishedWinnersInTheirActualRound() {
        Competition competition = Competition.builder().id(9L)
                .ownerLeague(League.builder().id(7L).build()).build();
        Team a = Team.builder().name("A").competition(competition).build();
        Team b = Team.builder().name("B").competition(competition).build();
        Team c = Team.builder().name("C").competition(competition).build();
        Match first = Match.builder().round("bracket-1").homeTeam(a).awayTeam(b)
                .winnerTeam(a).finished(true).build();
        Match bye = Match.builder().round("bracket-1").homeTeam(c).build();
        Match finalMatch = Match.builder().round("bracket-2").homeTeam(a).awayTeam(c)
                .winnerTeam(a).finished(false).build();
        when(matches.findByCompetitionId(9L)).thenReturn(List.of(first, bye, finalMatch));
        PredictionDataDTO data = new PredictionDataDTO();
        data.setCustomRounds(List.of(List.of("A", "C"), List.of("A")));
        Prediction prediction = Prediction.builder().edition(Edition.builder().competition(competition)
                .poolFormat(PoolFormat.KNOCKOUTS_ONLY).build()).bracketData(data).build();

        var score = service.score(prediction);
        assertEquals(60, score.getR32());
        assertEquals(60, score.getTotal());
    }

    @Test
    void groupPositionsAreScoredWithTheGroupOfEachParticipation() {
        Competition competition = Competition.builder().id(9L)
                .ownerLeague(League.builder().id(7L).build()).build();
        Team a = Team.builder().id(1L).name("A").competition(competition).build();
        Team b = Team.builder().id(2L).name("B").competition(competition).build();
        when(teams.findByCompetitionIdOrderByNameAsc(9L)).thenReturn(List.of(a, b));
        when(competitionTeams.groupByTeamId(9L)).thenReturn(java.util.Map.of(1L, "Norte", 2L, "Norte"));
        when(matches.findByCompetitionId(9L)).thenReturn(List.of(
                Match.builder().id(1L).round("group").groupName("Norte").homeTeam(a).awayTeam(b)
                        .homeScore(0).awayScore(2).finished(true).build()));
        PredictionDataDTO data = new PredictionDataDTO();
        data.setCustomRounds(List.of());
        data.setGroups(java.util.Map.of("Norte", List.of("B", "A")));
        Edition edition = Edition.builder().competition(competition).poolFormat(PoolFormat.FULL_BRACKET).build();
        Prediction prediction = Prediction.builder().edition(edition).bracketData(data).build();

        var score = service.score(prediction);

        int perPosition = app.porrapp.scoring.ScoringRuleSet.effectiveForEdition(edition).getGroupExactPositionPoints();
        assertEquals(2 * perPosition, score.getR1());
        assertEquals(2, score.getLog().size());
    }

    @Test
    void officialTournamentScoresEachRealKnockoutRound() {
        Competition worlds = Competition.builder().id(19L).externalId("lol.worlds").formatType("TOURNAMENT").build();
        Team a = Team.builder().name("A").competition(worlds).build();
        Team b = Team.builder().name("B").competition(worlds).build();
        Team c = Team.builder().name("C").competition(worlds).build();
        Team d = Team.builder().name("D").competition(worlds).build();
        when(matches.findByCompetitionId(19L)).thenReturn(List.of(
                Match.builder().id(1L).round("group").homeTeam(a).awayTeam(c).winnerTeam(c).finished(true).build(),
                Match.builder().id(2L).round("sf").homeTeam(a).awayTeam(b).winnerTeam(b).finished(true).build(),
                Match.builder().id(3L).round("sf").homeTeam(c).awayTeam(d).winnerTeam(c).finished(true).build(),
                Match.builder().id(4L).round("final").homeTeam(b).awayTeam(c).finished(false).build()));
        PredictionDataDTO data = new PredictionDataDTO();
        data.setCustomRounds(List.of(List.of("A", "C"), List.of("C")));
        Prediction prediction = Prediction.builder().edition(Edition.builder().competition(worlds)
                .poolFormat(PoolFormat.KNOCKOUTS_ONLY).build()).bracketData(data).build();

        var score = service.score(prediction);
        assertEquals(1, score.getLog().size());
        assertEquals("Ganador acertado: C", score.getLog().get(0).getMsg());
    }
}
