package com.porra.mundial.service.formulaone;

import com.porra.mundial.dto.GrandPrixBoardDTO;
import com.porra.mundial.exception.BusinessException;
import com.porra.mundial.model.Competition;
import com.porra.mundial.model.Edition;
import com.porra.mundial.model.League;
import com.porra.mundial.model.Match;
import com.porra.mundial.model.MatchPrediction;
import com.porra.mundial.model.MatchStatusNormalized;
import com.porra.mundial.model.PoolFormat;
import com.porra.mundial.model.Prediction;
import com.porra.mundial.model.UserAccount;
import com.porra.mundial.repository.EditionRepository;
import com.porra.mundial.repository.MatchPredictionRepository;
import com.porra.mundial.repository.MatchRepository;
import com.porra.mundial.service.league.LeagueService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Predicciones de la temporada para las estadísticas y el buscador de una liga de Fórmula 1. */
@ExtendWith(MockitoExtension.class)
class GrandPrixSeasonPicksTest {

    private static final Long GROUP_ID = 10L;
    private static final String EMAIL = "ana@test.com";

    @Mock
    private EditionRepository editionRepository;
    @Mock
    private MatchRepository matchRepository;
    @Mock
    private MatchPredictionRepository matchPredictionRepository;
    @Mock
    private LeagueService leagueService;

    @InjectMocks
    private GrandPrixService service;

    private Competition competition;
    private Edition edition;
    private Instant now;

    @BeforeEach
    void setUp() {
        now = Instant.now();
        competition = Competition.builder().id(5L).build();
        edition = Edition.builder()
                .id(100L)
                .league(League.builder().id(GROUP_ID).name("Liga").build())
                .competition(competition)
                .status("ACTIVE")
                .poolFormat(PoolFormat.GRAND_PRIX)
                .build();
        lenient().when(editionRepository.findByLeagueIdAndStatus(GROUP_ID, "ACTIVE")).thenReturn(Optional.of(edition));
    }

    private Match grandPrix(long id, Instant qualifying, boolean finished) {
        return Match.builder()
                .id(id)
                .competition(competition)
                .round("Gran Premio " + id)
                .matchDate(qualifying)
                .finished(finished)
                .status(finished ? MatchStatusNormalized.FINISHED : MatchStatusNormalized.SCHEDULED)
                .build();
    }

    private MatchPrediction pick(Match match, long userId, String name, String email, long winner, Integer points) {
        UserAccount user = UserAccount.builder().id(userId).participantName(name).googleEmail(email).build();
        Prediction prediction = Prediction.builder().id(userId).user(user).edition(edition).build();
        return MatchPrediction.builder()
                .prediction(prediction)
                .match(match)
                .raceFirstDriverId(winner)
                .raceSecondDriverId(2L)
                .raceThirdDriverId(3L)
                .racePoleDriverId(winner)
                .pointsAwarded(points)
                .build();
    }

    @Test
    @DisplayName("Solo salen los Grandes Premios cerrados, con las predicciones de toda la liga")
    void onlyClosedGrandsPrix() {
        Match finished = grandPrix(1, now.minus(10, ChronoUnit.DAYS), true);
        Match qualifyingStarted = grandPrix(2, now.minus(1, ChronoUnit.HOURS), false);
        Match open = grandPrix(3, now.plus(6, ChronoUnit.DAYS), false);
        when(matchRepository.findByCompetitionIdOrderByMatchDateAsc(5L))
                .thenReturn(List.of(finished, qualifyingStarted, open));
        when(matchPredictionRepository.findWithMatchAndUserByEditionId(100L)).thenReturn(List.of(
                pick(finished, 1, "Ana", EMAIL, 11, 4),
                pick(finished, 2, "Berto", "berto@test.com", 12, 9),
                pick(qualifyingStarted, 2, "Berto", "berto@test.com", 12, null),
                // Abierto: ni la de otro ni la propia entran en las estadísticas.
                pick(open, 1, "Ana", EMAIL, 11, null),
                pick(open, 2, "Berto", "berto@test.com", 14, null)));

        List<GrandPrixBoardDTO.RacePicks> races = service.seasonPicks(EMAIL, GROUP_ID);

        assertEquals(List.of(1L, 2L), races.stream().map(GrandPrixBoardDTO.RacePicks::matchId).toList());
        // Más puntos primero.
        assertEquals(List.of("Berto", "Ana"),
                races.get(0).picks().stream().map(GrandPrixBoardDTO.MemberPick::name).toList());
        GrandPrixBoardDTO.MemberPick mine = races.get(0).picks().get(1);
        assertTrue(mine.mine());
        assertEquals(11L, mine.pick().first());
        assertEquals(11L, mine.pick().pole());
        assertEquals(1, races.get(1).picks().size());
    }

    @Test
    @DisplayName("Un Gran Premio cerrado sin predicciones sale vacío")
    void closedWithoutPicks() {
        when(matchRepository.findByCompetitionIdOrderByMatchDateAsc(5L))
                .thenReturn(List.of(grandPrix(1, now.minus(2, ChronoUnit.DAYS), true)));
        when(matchPredictionRepository.findWithMatchAndUserByEditionId(100L)).thenReturn(List.of());

        List<GrandPrixBoardDTO.RacePicks> races = service.seasonPicks(EMAIL, GROUP_ID);

        assertEquals(1, races.size());
        assertTrue(races.get(0).picks().isEmpty());
    }

    @Test
    @DisplayName("Con todo abierto no se consulta ninguna predicción")
    void nothingBeforeTheFirstLock() {
        when(matchRepository.findByCompetitionIdOrderByMatchDateAsc(5L))
                .thenReturn(List.of(grandPrix(1, now.plus(2, ChronoUnit.DAYS), false)));

        assertTrue(service.seasonPicks(EMAIL, GROUP_ID).isEmpty());
        verify(matchPredictionRepository, never()).findWithMatchAndUserByEditionId(100L);
    }

    @Test
    @DisplayName("Quien no puede ver la liga no recibe nada")
    void rejectsOutsiders() {
        doThrow(BusinessException.forbidden("No perteneces a esta liga privada"))
                .when(leagueService).assertCanView(GROUP_ID, "otro@test.com");

        assertThrows(BusinessException.class, () -> service.seasonPicks("otro@test.com", GROUP_ID));
        verify(matchPredictionRepository, never()).findWithMatchAndUserByEditionId(100L);
    }

    @Test
    @DisplayName("Una liga que no es de Fórmula 1 no tiene predicciones de Gran Premio")
    void rejectsOtherFormats() {
        edition.setPoolFormat(PoolFormat.MATCH_DAY);

        assertThrows(BusinessException.class, () -> service.seasonPicks(EMAIL, GROUP_ID));
    }
}
