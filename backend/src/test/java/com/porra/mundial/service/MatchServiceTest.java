package com.porra.mundial.service;

import com.porra.mundial.model.Match;
import com.porra.mundial.model.MatchStatusNormalized;
import com.porra.mundial.repository.MatchRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageRequest;
import java.time.LocalDateTime;
import java.util.List;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MatchServiceTest {
    @Mock private MatchRepository matchRepository;
    @InjectMocks private MatchService matchService;

    @Test
    void queriesOnlyTheLiveTimeWindowAndCompetition() {
        var result = List.of(Match.builder().id(1L).build());
        when(matchRepository.findRadarLive(eq(7L), any(), any(), any())).thenReturn(result);
        var before = LocalDateTime.now();
        assertThat(matchService.getLiveMatches(7L)).isSameAs(result);
        var after = LocalDateTime.now();
        verify(matchRepository).findRadarLive(eq(7L),
                argThat(date -> !date.isBefore(before.minusHours(3).minusMinutes(30))
                        && !date.isAfter(after.minusHours(3).minusMinutes(30))),
                argThat(date -> !date.isBefore(before.plusMinutes(20)) && !date.isAfter(after.plusMinutes(20))),
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
