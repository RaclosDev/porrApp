package com.porra.mundial.service;

import com.porra.mundial.exception.BusinessException;
import com.porra.mundial.model.Competition;
import com.porra.mundial.model.Match;
import com.porra.mundial.model.MatchStatusNormalized;
import com.porra.mundial.repository.CompetitionRepository;
import com.porra.mundial.repository.MatchRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageRequest;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MatchServiceTest {
    @Mock private MatchRepository matchRepository;
    @Mock private CompetitionRepository competitionRepository;
    @InjectMocks private MatchService matchService;

    @Test
    void privateCompetitionsAreNotFound() {
        when(competitionRepository.existsByIdAndOwnerLeagueIsNotNull(9L)).thenReturn(true);
        assertThatThrownBy(() -> matchService.requirePublicCompetition(9L)).isInstanceOf(BusinessException.class);
        matchService.requirePublicCompetition(null);
        verify(competitionRepository).existsByIdAndOwnerLeagueIsNotNull(9L);
    }

    @Test
    void publicOnlyDropsMatchesOfPrivateCompetitions() {
        Match privateMatch = Match.builder().id(1L).competition(Competition.builder().id(9L).build()).build();
        Match worldCup = Match.builder().id(2L).competition(Competition.builder().id(1L).build()).build();
        Match noCompetition = Match.builder().id(3L).build();
        when(competitionRepository.findPrivateCompetitionIds()).thenReturn(List.of(9L));

        assertThat(matchService.publicOnly(List.of(privateMatch, worldCup, noCompetition)))
                .containsExactly(worldCup, noCompetition);
        assertThat(matchService.publicOnly(List.of())).isEmpty();
    }

    @Test
    void queriesOnlyTheLiveTimeWindowAndCompetition() {
        var result = List.of(Match.builder().id(1L).build());
        when(matchRepository.findRadarLive(eq(7L), any(), any(), any())).thenReturn(result);
        var before = Instant.now();
        assertThat(matchService.getLiveMatches(7L)).isSameAs(result);
        var after = Instant.now();
        verify(matchRepository).findRadarLive(eq(7L),
                argThat(date -> !date.isBefore(before.minus(3, ChronoUnit.HOURS).minus(30, ChronoUnit.MINUTES))
                        && !date.isAfter(after.minus(3, ChronoUnit.HOURS).minus(30, ChronoUnit.MINUTES))),
                argThat(date -> !date.isBefore(before.plus(20, ChronoUnit.MINUTES)) && !date.isAfter(after.plus(20, ChronoUnit.MINUTES))),
                eq(List.of(MatchStatusNormalized.SCHEDULED, MatchStatusNormalized.LIVE, MatchStatusNormalized.PAUSED)));
        verifyNoMoreInteractions(matchRepository);
    }

    @Test
    void sendsTheRequestedLimitToTheDatabaseAndSkipsEmptyPages() {
        matchService.getLastMatches(5, 7L);
        matchService.getNextMatches(3, 7L);
        assertThat(matchService.getLastMatches(0)).isEmpty();
        assertThat(matchService.getNextMatches(0)).isEmpty();
        verify(matchRepository).findRadarLast(7L, PageRequest.of(0, 5));
        verify(matchRepository).findRadarNext(eq(7L), any(), eq(MatchStatusNormalized.SCHEDULED), eq(PageRequest.of(0, 3)));
        verifyNoMoreInteractions(matchRepository);
    }
}
