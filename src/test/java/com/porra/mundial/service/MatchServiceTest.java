package com.porra.mundial.service;

import com.porra.mundial.model.Match;
import com.porra.mundial.repository.MatchRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MatchServiceTest {

    @Mock
    private MatchRepository matchRepository;

    @InjectMocks
    private MatchService matchService;

    @Test
    void testGetLiveMatches() {
        LocalDateTime now = LocalDateTime.now();
        
        // Partido que terminó hace tiempo
        Match finishedMatch = Match.builder().id(1L).finished(true).matchDate(now.minusHours(2)).build();
        
        // Partido que es en 2 días
        Match futureMatch = Match.builder().id(2L).finished(false).matchDate(now.plusDays(2)).build();
        
        // Partido que empezó hace 10 minutos (en vivo)
        Match liveMatch = Match.builder().id(3L).finished(false).matchDate(now.minusMinutes(10)).build();
        
        // Partido que empieza en 15 minutos (a punto de empezar, consideramos en vivo para el radar)
        Match startingSoonMatch = Match.builder().id(4L).finished(false).matchDate(now.plusMinutes(15)).build();

        when(matchRepository.findAll()).thenReturn(Arrays.asList(finishedMatch, futureMatch, liveMatch, startingSoonMatch));

        List<Match> liveMatches = matchService.getLiveMatches();

        assertEquals(2, liveMatches.size(), "Debería haber 2 partidos en vivo o a punto de empezar");
        // Deberían estar ordenados por fecha descendente (el que empieza en 15 min primero, luego el que empezó hace 10)
        assertEquals(4L, liveMatches.get(0).getId());
        assertEquals(3L, liveMatches.get(1).getId());
    }
}
