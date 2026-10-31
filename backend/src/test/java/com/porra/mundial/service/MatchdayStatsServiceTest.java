package com.porra.mundial.service;

import com.porra.mundial.dto.MatchdayStatsDTO;
import com.porra.mundial.dto.MatchdayStatsDTO.MatchStats;
import com.porra.mundial.dto.MatchdayStatsDTO.ScoreCount;
import com.porra.mundial.model.*;
import com.porra.mundial.repository.EditionRepository;
import com.porra.mundial.repository.MatchPredictionRepository;
import com.porra.mundial.repository.MembershipRepository;
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
class MatchdayStatsServiceTest {

    private static final Long GROUP_ID = 10L;
    private static final String EMAIL = "player@test.com";

    @Mock
    private GroupService groupService;

    @Mock
    private EditionRepository editionRepository;

    @Mock
    private MatchPredictionRepository matchPredictionRepository;

    @Mock
    private MembershipRepository membershipRepository;

    @InjectMocks
    private MatchdayStatsService service;

    private Edition edition;
    private Team home;
    private Team away;

    @BeforeEach
    void setUp() {
        edition = Edition.builder()
                .id(100L)
                .league(League.builder().id(GROUP_ID).name("Liga").build())
                .status("ACTIVE")
                .poolFormat(PoolFormat.MATCH_DAY)
                .build();
        home = Team.builder().id(1L).name("Real Madrid").logoUrl("rm.png").build();
        away = Team.builder().id(2L).name("Barcelona").build();
        lenient().when(editionRepository.findByLeagueIdAndStatus(GROUP_ID, "ACTIVE")).thenReturn(Optional.of(edition));
        lenient().when(membershipRepository.countByLeagueId(GROUP_ID)).thenReturn(6L);
    }

    private Match match(long id, LocalDateTime date, boolean finished, Integer homeScore, Integer awayScore) {
        return Match.builder()
                .id(id)
                .homeTeam(home)
                .awayTeam(away)
                .matchDate(date)
                .finished(finished)
                .homeScore(homeScore)
                .awayScore(awayScore)
                .round("Jornada 3")
                .status(finished ? MatchStatusNormalized.FINISHED : MatchStatusNormalized.SCHEDULED)
                .build();
    }

    private static MatchPrediction score(Match match, int home, int away) {
        return MatchPrediction.builder().match(match).homeScore(home).awayScore(away)
                .predictionSign(home > away ? "1" : home == away ? "X" : "2").build();
    }

    private static MatchPrediction signOnly(Match match, String sign) {
        return MatchPrediction.builder().match(match).predictionSign(sign).build();
    }

    @Test
    @DisplayName("Sin ser miembro de la liga no se ve nada")
    void rejectsNonMembers() {
        doThrow(new SecurityException("No perteneces a esta liga privada"))
                .when(groupService).assertCanView(GROUP_ID, "other@test.com");

        assertThrows(SecurityException.class, () -> service.getStats("other@test.com", GROUP_ID));
        verifyNoInteractions(matchPredictionRepository);
    }

    @Test
    @DisplayName("Una liga que no es por jornadas no tiene estadísticas de partidos")
    void bracketLeagueHasNoMatchStats() {
        edition.setPoolFormat(PoolFormat.FULL_BRACKET);

        MatchdayStatsDTO stats = service.getStats(EMAIL, GROUP_ID);

        assertEquals(0, stats.members());
        assertTrue(stats.matches().isEmpty());
        verifyNoInteractions(matchPredictionRepository);
    }

    @Test
    @DisplayName("Los partidos sin empezar no se agregan: sus pronósticos siguen ocultos")
    void hidesMatchesThatHaveNotStarted() {
        Match future = match(1L, LocalDateTime.now().plusHours(2), false, null, null);
        Match started = match(2L, LocalDateTime.now().minusMinutes(20), false, 1, 0);
        started.setStatus(MatchStatusNormalized.LIVE);
        when(matchPredictionRepository.findWithMatchByEditionId(100L)).thenReturn(List.of(
                score(future, 2, 0), score(started, 1, 1), score(future, 0, 0)));

        MatchdayStatsDTO stats = service.getStats(EMAIL, GROUP_ID);

        assertEquals(6, stats.members());
        assertEquals(1, stats.matches().size());
        MatchStats live = stats.matches().get(0);
        assertEquals(2L, live.matchId());
        assertTrue(live.live());
        assertFalse(live.finished());
        assertEquals(1, live.predictions());
        assertNull(live.exactHits(), "Sin terminar no hay aciertos que contar");
        assertNull(live.signHits());
    }

    @Test
    @DisplayName("Si la porra está cerrada se ven todos los partidos")
    void lockedEditionRevealsEveryMatch() {
        edition.setLockDate(LocalDateTime.now().minusDays(1));
        Match future = match(1L, LocalDateTime.now().plusDays(3), false, null, null);
        when(matchPredictionRepository.findWithMatchByEditionId(100L)).thenReturn(List.of(score(future, 2, 1)));

        assertEquals(1, service.getStats(EMAIL, GROUP_ID).matches().size());
    }

    @Test
    @DisplayName("Cuenta signos, marcadores más repetidos y aciertos de un partido terminado")
    void aggregatesFinishedMatch() {
        Match finished = match(3L, LocalDateTime.now().minusDays(1), true, 2, 1);
        when(matchPredictionRepository.findWithMatchByEditionId(100L)).thenReturn(List.of(
                score(finished, 2, 1),
                score(finished, 2, 1),
                score(finished, 1, 0),
                score(finished, 1, 1),
                score(finished, 0, 2),
                score(finished, 3, 0),
                signOnly(finished, "x")));

        MatchStats stats = service.getStats(EMAIL, GROUP_ID).matches().get(0);

        assertEquals("Jornada 3", stats.round());
        assertEquals("Real Madrid", stats.homeTeam());
        assertEquals("rm.png", stats.homeTeamLogo());
        assertEquals(7, stats.predictions());
        assertEquals(4, stats.homeWins());
        assertEquals(2, stats.draws(), "El signo suelto cuenta en el reparto 1X2");
        assertEquals(1, stats.awayWins());
        assertEquals(2, stats.exactHits());
        assertEquals(4, stats.signHits());
        assertEquals(MatchdayStatsService.TOP_SCORES, stats.topScores().size());
        assertEquals(new ScoreCount(2, 1, 2), stats.topScores().get(0));
        // Empate a un voto: primero el de menos goles del local.
        assertEquals(new ScoreCount(0, 2, 1), stats.topScores().get(1));
    }

    @Test
    @DisplayName("Los partidos salen por fecha")
    void sortsMatchesByDate() {
        Match later = match(5L, LocalDateTime.now().minusHours(1), false, null, null);
        Match earlier = match(4L, LocalDateTime.now().minusDays(2), true, 0, 0);
        when(matchPredictionRepository.findWithMatchByEditionId(100L)).thenReturn(List.of(
                score(later, 1, 0), score(earlier, 0, 0)));

        List<MatchStats> matches = service.getStats(EMAIL, GROUP_ID).matches();

        assertEquals(List.of(4L, 5L), matches.stream().map(MatchStats::matchId).toList());
    }
}
