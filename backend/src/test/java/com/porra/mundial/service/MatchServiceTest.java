package com.porra.mundial.service;

import com.porra.mundial.model.Competition;
import com.porra.mundial.model.Match;
import com.porra.mundial.model.MatchStatusNormalized;
import com.porra.mundial.model.Team;
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

    @Test
    void postponedAndCancelledMatchesAreNotLiveOrUpcoming() {
        var postponed = Match.builder().id(1L).matchDate(LocalDateTime.now().plusMinutes(5))
                .status(MatchStatusNormalized.POSTPONED).build();
        var cancelled = Match.builder().id(2L).matchDate(LocalDateTime.now().plusMinutes(10))
                .status(MatchStatusNormalized.CANCELLED).build();
        when(matchRepository.findAll()).thenReturn(List.of(postponed, cancelled));
        when(matchRepository.findByFinishedFalseOrderByMatchDateAsc()).thenReturn(List.of(postponed, cancelled));
        assertEquals(List.of(), matchService.getLiveMatches());
        assertEquals(List.of(), matchService.getNextMatches(5));
    }

    @Test
    void testGetLiveMatches_FiltersByCompetitionAndExcludesBogus() {
        LocalDateTime now = LocalDateTime.now();
        Competition worldCup = Competition.builder().id(1L).name("World Cup 2026").build();
        Competition laLiga = Competition.builder().id(2L).name("LaLiga").build();

        Team spain = Team.builder().id(10L).name("España").build();
        Team france = Team.builder().id(20L).name("Francia").build();
        Team tbd1 = Team.builder().id(99L).name("Por definir").build();
        Team tbd2 = Team.builder().id(98L).name("Por definir").build();

        // Partido en vivo del Mundial
        Match wcMatch = Match.builder()
                .id(101L)
                .competition(worldCup)
                .homeTeam(spain)
                .awayTeam(france)
                .finished(false)
                .matchDate(now.minusMinutes(20))
                .build();

        // Partido en vivo de LaLiga
        Match laLigaMatch = Match.builder()
                .id(102L)
                .competition(laLiga)
                .finished(false)
                .matchDate(now.minusMinutes(15))
                .build();

        // Partido fantasma con ambos 'Por definir'
        Match bogusMatch = Match.builder()
                .id(103L)
                .competition(worldCup)
                .homeTeam(tbd1)
                .awayTeam(tbd2)
                .finished(false)
                .matchDate(now.minusMinutes(5))
                .build();

        when(matchRepository.findAll()).thenReturn(Arrays.asList(wcMatch, laLigaMatch, bogusMatch));

        List<Match> filtered = matchService.getLiveMatches(1L);

        assertEquals(1, filtered.size(), "Solo debe devolver el partido del Mundial y excluir el fantasma y el de LaLiga");
        assertEquals(101L, filtered.get(0).getId());
    }
}
