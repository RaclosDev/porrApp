package com.porra.mundial.service;

import com.porra.mundial.dto.PredictionDataDTO;
import com.porra.mundial.model.Match;
import com.porra.mundial.model.Team;
import com.porra.mundial.repository.MatchRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class KnockoutBracketServiceTest {

    @Mock
    private MatchRepository matchRepository;

    @InjectMocks
    private KnockoutBracketService service;

    private Team spain;
    private Team france;
    private Team brazil;
    private Team argentina;
    private Team placeholder;

    @BeforeEach
    void setUp() {
        spain = Team.builder().id(1L).name("España").build();
        france = Team.builder().id(2L).name("Francia").build();
        brazil = Team.builder().id(3L).name("Brasil").build();
        argentina = Team.builder().id(4L).name("Argentina").build();
        placeholder = Team.builder().id(99L).name(Team.PLACEHOLDER_NAME).nameEn(Team.PLACEHOLDER_NAME_EN).build();
    }

    private Match knockout(String round, Team home, Team away, Integer homeScore, Integer awayScore, int day) {
        return Match.builder()
                .round(round)
                .homeTeam(home)
                .awayTeam(away)
                .homeScore(homeScore)
                .awayScore(awayScore)
                .finished(homeScore != null)
                .matchDate(LocalDateTime.of(2026, 7, day, 21, 0))
                .build();
    }

    @Test
    @DisplayName("Coloca ganadores de semis en la final y perdedores en el tercer puesto")
    void propagatesSemiFinalResults() {
        Match semi1 = knockout("sf", spain, france, 2, 1, 14);
        Match semi2 = knockout("sf", brazil, argentina, 0, 1, 15);
        Match finalMatch = knockout("final", placeholder, placeholder, null, null, 19);
        Match third = knockout("third", placeholder, placeholder, null, null, 18);
        when(matchRepository.findAll()).thenReturn(List.of(semi1, semi2, finalMatch, third));

        int updated = service.propagateKnockoutWinners();

        assertEquals(4, updated);
        assertSame(spain, finalMatch.getHomeTeam());
        assertSame(argentina, finalMatch.getAwayTeam());
        assertSame(france, third.getHomeTeam());
        assertSame(brazil, third.getAwayTeam());
        verify(matchRepository, times(4)).save(any(Match.class));
    }

    @Test
    @DisplayName("No toca nada si las semifinales aún no se han jugado")
    void doesNothingWithoutDecidedSemis() {
        Match semi1 = knockout("sf", spain, france, null, null, 14);
        Match finalMatch = knockout("final", placeholder, placeholder, null, null, 19);
        when(matchRepository.findAll()).thenReturn(List.of(semi1, finalMatch));

        assertEquals(0, service.propagateKnockoutWinners());
        verify(matchRepository, never()).save(any());
    }

    @Test
    @DisplayName("Completa final, tercer puesto, campeón y ganador del tercer puesto en el cuadro oficial")
    void enrichesOfficialBracket() {
        Match semi1 = knockout("sf", spain, france, 2, 1, 14);
        Match semi2 = knockout("sf", brazil, argentina, 0, 1, 15);
        Match finalMatch = knockout("final", spain, argentina, 3, 2, 19);
        finalMatch.setWinnerTeam(spain);
        Match third = knockout("third", france, brazil, 1, 0, 18);
        when(matchRepository.findAll()).thenReturn(List.of(semi1, semi2, finalMatch, third));

        PredictionDataDTO dto = new PredictionDataDTO();
        service.enrichPredictionDataWithMatches(dto);

        assertEquals(List.of("España", "Argentina"), dto.getFinalMatch());
        assertEquals("España", dto.getChampion());
        assertEquals(List.of("Francia", "Brasil"), dto.getThirdPlaceMatch());
        assertEquals("Francia", dto.getThirdPlaceWinner());
    }

    @Test
    @DisplayName("Sin partido final creado, deduce los finalistas de las semis")
    void derivesFinalistsFromSemisWhenFinalIsMissing() {
        Match semi1 = knockout("semifinal", spain, france, 1, 0, 14);
        Match semi2 = knockout("semifinal", brazil, argentina, 2, 0, 15);
        when(matchRepository.findAll()).thenReturn(List.of(semi1, semi2));

        PredictionDataDTO dto = new PredictionDataDTO();
        service.enrichPredictionDataWithMatches(dto);

        assertEquals(List.of("España", "Brasil"), dto.getFinalMatch());
        assertEquals(List.of("Francia", "Argentina"), dto.getThirdPlaceMatch());
        assertNull(dto.getChampion());
    }

    @Test
    @DisplayName("Los partidos de grupo nunca cuentan como eliminatoria")
    void groupMatchesAreNotKnockout() {
        Match group = Match.builder().groupName("A").round("final").build();
        assertFalse(KnockoutBracketService.isKnockoutMatch(group));
        assertTrue(KnockoutBracketService.isKnockoutMatch(Match.builder().round("qf").build()));
    }
}
