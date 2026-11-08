package com.porra.mundial.service.league;

import com.porra.mundial.exception.BusinessException;
import com.porra.mundial.model.Competition;
import com.porra.mundial.model.Edition;
import com.porra.mundial.model.League;
import com.porra.mundial.model.PoolFormat;
import com.porra.mundial.model.PredictionLockMode;
import com.porra.mundial.model.UserAccount;
import com.porra.mundial.repository.CompetitionRepository;
import com.porra.mundial.repository.EditionRepository;
import com.porra.mundial.repository.LeagueRepository;
import com.porra.mundial.repository.MatchRepository;
import com.porra.mundial.repository.MembershipRepository;
import com.porra.mundial.repository.PredictionRepository;
import com.porra.mundial.repository.TeamRepository;
import com.porra.mundial.repository.UserAccountRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.context.ApplicationEventPublisher;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Crear una liga de los playoffs de la NBA, aunque aún no haya series. */
class LeagueServiceNbaTest {

    private static final String EMAIL = "admin@example.test";

    private final LeagueRepository leagues = mock(LeagueRepository.class);
    private final CompetitionRepository competitions = mock(CompetitionRepository.class);
    private final EditionRepository editions = mock(EditionRepository.class);
    private final UserAccountRepository users = mock(UserAccountRepository.class);
    private LeagueService service;

    @BeforeEach
    void setUp() {
        service = new LeagueService(leagues, mock(PredictionRepository.class), users, competitions, editions,
                mock(MembershipRepository.class), mock(MatchRepository.class), mock(TeamRepository.class),
                mock(ApplicationEventPublisher.class));
        when(users.findByGoogleEmail(EMAIL)).thenReturn(Optional.of(UserAccount.builder().id(1L).googleEmail(EMAIL).build()));
        when(leagues.findByJoinCode(any())).thenReturn(Optional.empty());
        when(leagues.save(any(League.class))).thenAnswer(call -> {
            League league = call.getArgument(0);
            league.setId(9L);
            return league;
        });
        when(competitions.findById(15L)).thenReturn(Optional.of(Competition.builder().id(15L).name("NBA")
                .externalId(Competition.NBA_EXTERNAL_ID).formatType("TOURNAMENT").build()));
    }

    @Test
    @DisplayName("La liga de la NBA cierra serie a serie y no tiene pichichi aunque se pida")
    void nbaLeagueLocksPerSeriesWithoutTopScorer() {
        service.createLeague(new NewLeague("Playoffs", EMAIL, 15L, PoolFormat.KNOCKOUTS_ONLY, true, null, null));

        ArgumentCaptor<Edition> edition = ArgumentCaptor.forClass(Edition.class);
        verify(editions).save(edition.capture());
        assertEquals(PredictionLockMode.PER_MATCH, edition.getValue().getLockMode());
        assertFalse(edition.getValue().isPichichi());
    }

    @Test
    @DisplayName("De la NBA solo se juegan los playoffs")
    void nbaRejectsOtherFormats() {
        BusinessException error = assertThrows(BusinessException.class, () -> service.createLeague(
                NewLeague.of("Jornadas", EMAIL, 15L, PoolFormat.MATCH_DAY)));
        assertTrue(error.getMessage().contains("playoffs"));
    }

    @Test
    @DisplayName("La temporada regular de la NBA se juega por semanas o en superviviente, nunca con cuadro")
    void nbaRegularSeasonIsMatchBased() {
        when(competitions.findById(16L)).thenReturn(Optional.of(Competition.builder().id(16L)
                .name("NBA · Temporada regular").externalId(Competition.NBA_REGULAR_SEASON_EXTERNAL_ID)
                .formatType("LEAGUE").build()));

        BusinessException error = assertThrows(BusinessException.class, () -> service.createLeague(
                NewLeague.of("Cuadro", EMAIL, 16L, PoolFormat.KNOCKOUTS_ONLY)));
        assertTrue(error.getMessage().contains("partido a partido"));

        service.createLeague(NewLeague.of("Semanas", EMAIL, 16L, PoolFormat.MATCH_DAY));
        ArgumentCaptor<Edition> edition = ArgumentCaptor.forClass(Edition.class);
        verify(editions).save(edition.capture());
        assertEquals(PredictionLockMode.FIXED_DATE, edition.getValue().getLockMode());
    }
}
