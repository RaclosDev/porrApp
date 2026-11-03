package com.porra.mundial.service;

import com.porra.mundial.dto.PredictionDataDTO;
import com.porra.mundial.model.Competition;
import com.porra.mundial.model.Edition;
import com.porra.mundial.model.League;
import com.porra.mundial.model.Match;
import com.porra.mundial.model.PoolFormat;
import com.porra.mundial.model.Prediction;
import com.porra.mundial.model.Team;
import com.porra.mundial.repository.MatchRepository;
import com.porra.mundial.repository.TeamRepository;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class CustomBracketScoringServiceTest {
    private final MatchRepository matches = mock(MatchRepository.class);
    private final TeamRepository teams = mock(TeamRepository.class);
    private final CustomBracketScoringService service = new CustomBracketScoringService(matches, teams);

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
}
