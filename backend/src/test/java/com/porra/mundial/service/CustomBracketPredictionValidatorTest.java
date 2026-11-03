package com.porra.mundial.service;

import com.porra.mundial.dto.PredictionDataDTO;
import com.porra.mundial.exception.BusinessException;
import com.porra.mundial.model.Competition;
import com.porra.mundial.model.Edition;
import com.porra.mundial.model.League;
import com.porra.mundial.model.Match;
import com.porra.mundial.model.PoolFormat;
import com.porra.mundial.model.Team;
import com.porra.mundial.repository.MatchRepository;
import com.porra.mundial.repository.TeamRepository;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class CustomBracketPredictionValidatorTest {
    private final TeamRepository teams = mock(TeamRepository.class);
    private final MatchRepository matches = mock(MatchRepository.class);
    private final CustomBracketPredictionValidator validator = new CustomBracketPredictionValidator(teams, matches);
    private final Competition competition = Competition.builder().id(9L)
            .ownerLeague(League.builder().id(7L).build()).build();

    private Team team(String name, String group) {
        return Team.builder().name(name).groupName(group).competition(competition).build();
    }

    private Match fixture(long id, Team home, Team away) {
        return Match.builder().id(id).competition(competition).round("bracket-1")
                .homeTeam(home).awayTeam(away).build();
    }

    @Test
    void directBracketWithByeAndAnyTeamCount() {
        Team a = team("A", null);
        Team b = team("B", null);
        Team c = team("C", null);
        when(teams.findByCompetitionIdOrderByNameAsc(9L)).thenReturn(List.of(a, b, c));
        when(matches.findByCompetitionId(9L)).thenReturn(List.of(fixture(1L, a, b), fixture(2L, c, null)));
        Edition edition = Edition.builder().competition(competition).poolFormat(PoolFormat.KNOCKOUTS_ONLY).build();
        PredictionDataDTO data = new PredictionDataDTO();
        data.setCustomRounds(List.of(List.of("A", "C"), List.of("C")));
        data.setChampion("C");
        assertDoesNotThrow(() -> validator.validate(edition, data));
        data.setCustomRounds(List.of(List.of("B", "C"), List.of("A")));
        assertThrows(BusinessException.class, () -> validator.validate(edition, data));
    }

    @Test
    void groupFormatChecksEveryGroupSelection() {
        Team a = team("A", "Norte");
        Team b = team("B", "Norte");
        when(teams.findByCompetitionIdOrderByNameAsc(9L)).thenReturn(List.of(a, b));
        when(matches.findByCompetitionId(9L)).thenReturn(List.of(fixture(1L, a, b)));
        Edition edition = Edition.builder().competition(competition).poolFormat(PoolFormat.FULL_BRACKET).build();
        PredictionDataDTO data = new PredictionDataDTO();
        data.setGroups(Map.of("Norte", List.of("B", "A")));
        data.setCustomRounds(List.of(List.of("B")));
        data.setChampion("B");
        assertDoesNotThrow(() -> validator.validate(edition, data));
        data.setGroups(Map.of("Norte", List.of("A", "A")));
        assertThrows(BusinessException.class, () -> validator.validate(edition, data));
    }
}
