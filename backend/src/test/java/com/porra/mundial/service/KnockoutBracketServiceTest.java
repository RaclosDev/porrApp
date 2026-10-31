package com.porra.mundial.service;

import com.porra.mundial.dto.PredictionDataDTO;
import com.porra.mundial.model.Competition;
import com.porra.mundial.model.Match;
import com.porra.mundial.model.Team;
import com.porra.mundial.repository.CompetitionRepository;
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
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class KnockoutBracketServiceTest {

    @Mock
    private MatchRepository matchRepository;

    @Mock
    private CompetitionRepository competitionRepository;

    @Mock
    private ScoreInvalidationService scoreInvalidationService;

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

    private static final long WORLD_CUP_ID = 2L;

    private void givenWorldCupMatches(Match... matches) {
        when(competitionRepository.findIdByExternalId(Competition.WORLD_CUP_EXTERNAL_ID)).thenReturn(Optional.of(WORLD_CUP_ID));
        when(matchRepository.findByCompetitionId(WORLD_CUP_ID)).thenReturn(List.of(matches));
    }

    @Test
    void liveScoresNeverPropagateEvenWithAReportedWinner() {
        Match semi = knockout("sf", spain, france, 1, 0, 14);
        semi.setFinished(false);
        semi.setWinnerTeam(spain);
        Match finalMatch = knockout("final", placeholder, placeholder, null, null, 19);

        assertEquals(0, service.propagateKnockoutWinners(List.of(semi, finalMatch)));
        assertNull(KnockoutBracketService.winnerOf(semi));
        assertNull(KnockoutBracketService.loserOf(semi));
    }

    @Test
    void correctionUpdatesTheDerivedSlotWithoutMovingTheOtherSemiFinal() {
        Match first = knockout("sf", spain, france, 1, 0, 14);
        Match second = knockout("sf", brazil, argentina, 2, 0, 15);
        Match finalMatch = knockout("final", placeholder, placeholder, null, null, 19);
        Match third = knockout("third", placeholder, placeholder, null, null, 18);
        List<Match> matches = List.of(first, second, finalMatch, third);
        service.propagateKnockoutWinners(matches);

        first.setAwayScore(2);
        service.propagateKnockoutWinners(matches);

        assertSame(france, finalMatch.getHomeTeam());
        assertSame(brazil, finalMatch.getAwayTeam());
        assertSame(spain, third.getHomeTeam());
        assertSame(argentina, third.getAwayTeam());
    }

    @Test
    void secondSemiKeepsItsAwaySlotWhenFirstSemiIsUndecided() {
        Match first = knockout("sf", spain, france, null, null, 14);
        Match second = knockout("sf", brazil, argentina, 2, 0, 15);
        Match finalMatch = knockout("final", placeholder, placeholder, null, null, 19);

        service.propagateKnockoutWinners(List.of(first, second, finalMatch));

        assertSame(placeholder, finalMatch.getHomeTeam());
        assertSame(brazil, finalMatch.getAwayTeam());
    }

    @Test
    void repairsBothSidesWhenAnOldLivePropagationInsertedBothSemiFinalTeams() {
        Match semi = knockout("sf", spain, france, 1, 2, 14);
        Match finalMatch = knockout("final", spain, france, null, null, 19);

        service.propagateKnockoutWinners(List.of(semi, finalMatch));

        assertSame(france, finalMatch.getHomeTeam());
        assertNull(finalMatch.getAwayTeam());
    }

    @Test
    void preservesProviderTeamsAndAlreadyStartedMatches() {
        Match semi = knockout("sf", spain, france, 0, 1, 14);
        Match official = knockout("final", spain, brazil, null, null, 19);
        official.setExternalId("provider-final");
        Match live = knockout("third", spain, argentina, 1, 0, 18);
        live.setFinished(false);
        live.setStatus(com.porra.mundial.model.MatchStatusNormalized.LIVE);

        assertEquals(0, service.propagateKnockoutWinners(List.of(semi, official, live)));
        assertSame(spain, official.getHomeTeam());
        assertSame(spain, live.getHomeTeam());
    }

    @Test
    @DisplayName("Coloca ganadores de semis en la final y perdedores en el tercer puesto")
    void propagatesSemiFinalResults() {
        Match semi1 = knockout("sf", spain, france, 2, 1, 14);
        Match semi2 = knockout("sf", brazil, argentina, 0, 1, 15);
        Match finalMatch = knockout("final", placeholder, placeholder, null, null, 19);
        Match third = knockout("third", placeholder, placeholder, null, null, 18);
        givenWorldCupMatches(semi1, semi2, finalMatch, third);

        int updated = service.propagateKnockoutWinners();

        assertEquals(4, updated);
        assertSame(spain, finalMatch.getHomeTeam());
        assertSame(argentina, finalMatch.getAwayTeam());
        assertSame(france, third.getHomeTeam());
        assertSame(brazil, third.getAwayTeam());
        verify(matchRepository, times(4)).save(any(Match.class));
        verify(scoreInvalidationService).invalidateWorldCup();
    }

    @Test
    @DisplayName("Con los partidos del Mundial ya cargados, no los vuelve a leer")
    void propagatesWithTheMatchesItIsGiven() {
        Match semi1 = knockout("sf", spain, france, 2, 1, 14);
        Match semi2 = knockout("sf", brazil, argentina, 0, 1, 15);
        Match finalMatch = knockout("final", placeholder, placeholder, null, null, 19);

        assertEquals(2, service.propagateKnockoutWinners(List.of(semi1, semi2, finalMatch)));

        assertSame(spain, finalMatch.getHomeTeam());
        assertSame(argentina, finalMatch.getAwayTeam());
        verifyNoInteractions(competitionRepository);
        verify(matchRepository, never()).findByCompetitionId(any());
    }

    @Test
    @DisplayName("No toca nada si las semifinales aún no se han jugado")
    void doesNothingWithoutDecidedSemis() {
        Match semi1 = knockout("sf", spain, france, null, null, 14);
        Match finalMatch = knockout("final", placeholder, placeholder, null, null, 19);
        givenWorldCupMatches(semi1, finalMatch);

        assertEquals(0, service.propagateKnockoutWinners());
        verify(matchRepository, never()).save(any());
        verify(scoreInvalidationService, never()).invalidateWorldCup();
    }

    @Test
    @DisplayName("Completa final, tercer puesto, campeón y ganador del tercer puesto en el cuadro oficial")
    void enrichesOfficialBracket() {
        Match semi1 = knockout("sf", spain, france, 2, 1, 14);
        Match semi2 = knockout("sf", brazil, argentina, 0, 1, 15);
        Match finalMatch = knockout("final", spain, argentina, 3, 2, 19);
        finalMatch.setWinnerTeam(spain);
        Match third = knockout("third", france, brazil, 1, 0, 18);
        givenWorldCupMatches(semi1, semi2, finalMatch, third);

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
        givenWorldCupMatches(semi1, semi2);

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

    @Test
    @DisplayName("Las eliminatorias de otras competiciones no entran en el cuadro del Mundial")
    void ignoresKnockoutMatchesOfOtherCompetitions() {
        Team betis = Team.builder().id(20L).name("Real Betis").groupName("-").build();
        Team osasuna = Team.builder().id(21L).name("Osasuna").groupName("-").build();
        Match cupFinal = knockout("final", betis, osasuna, 2, 0, 1);
        cupFinal.setWinnerTeam(betis);
        Match semi1 = knockout("sf", spain, france, 2, 1, 14);
        Match semi2 = knockout("sf", brazil, argentina, 0, 1, 15);
        Match finalMatch = knockout("final", spain, argentina, 1, 0, 19);
        finalMatch.setWinnerTeam(spain);
        // Lo que devolvería una consulta sin filtrar: la final de copa va primero.
        lenient().when(matchRepository.findAll()).thenReturn(List.of(cupFinal, semi1, semi2, finalMatch));
        givenWorldCupMatches(semi1, semi2, finalMatch);

        PredictionDataDTO dto = new PredictionDataDTO();
        service.enrichPredictionDataWithMatches(dto);

        assertEquals(List.of("España", "Argentina"), dto.getFinalMatch());
        assertEquals("España", dto.getChampion());
    }
    @Test
    void spanishQuarterFinalIsNeverUsedAsTheFinal() {
        Match semi = knockout("Semifinal", spain, france, 2, 0, 14);
        Match quarter = knockout("Cuartos de final", placeholder, placeholder, null, null, 10);
        assertEquals(0, service.propagateKnockoutWinners(List.of(semi, quarter)));
        assertSame(placeholder, quarter.getHomeTeam());
    }

}
