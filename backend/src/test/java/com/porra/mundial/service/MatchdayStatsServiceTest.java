package com.porra.mundial.service;

import com.porra.mundial.exception.BusinessException;
import com.porra.mundial.dto.MatchVotersDTO;
import com.porra.mundial.dto.MatchdayStatsDTO;
import com.porra.mundial.dto.MatchdayStatsDTO.MatchStats;
import com.porra.mundial.dto.MatchdayStatsDTO.ScoreCount;
import com.porra.mundial.model.*;
import com.porra.mundial.repository.EditionRepository;
import com.porra.mundial.repository.MatchPredictionRepository;
import com.porra.mundial.repository.MatchRepository;
import com.porra.mundial.repository.MembershipRepository;
import com.porra.mundial.repository.PredictionRepository;
import com.porra.mundial.dto.PredictionDataDTO;
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

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
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

    @Mock
    private MatchRepository matchRepository;

    @Mock
    private PredictionRepository predictionRepository;

    @Mock
    private CustomLockService customLockService;

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

    private Match match(long id, Instant date, boolean finished, Integer homeScore, Integer awayScore) {
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
        doThrow(BusinessException.forbidden("No perteneces a esta liga privada"))
                .when(groupService).assertCanView(GROUP_ID, "other@test.com");

        assertThrows(BusinessException.class, () -> service.getStats("other@test.com", GROUP_ID));
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
        Match future = match(1L, Instant.now().plus(2, ChronoUnit.HOURS), false, null, null);
        Match started = match(2L, Instant.now().minus(20, ChronoUnit.MINUTES), false, 1, 0);
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
        edition.setLockDate(Instant.now().minus(1, ChronoUnit.DAYS));
        Match future = match(1L, Instant.now().plus(3, ChronoUnit.DAYS), false, null, null);
        when(matchPredictionRepository.findWithMatchByEditionId(100L)).thenReturn(List.of(score(future, 2, 1)));

        assertEquals(1, service.getStats(EMAIL, GROUP_ID).matches().size());
    }

    @Test
    @DisplayName("Cuenta signos, marcadores más repetidos y aciertos de un partido terminado")
    void aggregatesFinishedMatch() {
        Match finished = match(3L, Instant.now().minus(1, ChronoUnit.DAYS), true, 2, 1);
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
        Match later = match(5L, Instant.now().minus(1, ChronoUnit.HOURS), false, null, null);
        Match earlier = match(4L, Instant.now().minus(2, ChronoUnit.DAYS), true, 0, 0);
        when(matchPredictionRepository.findWithMatchByEditionId(100L)).thenReturn(List.of(
                score(later, 1, 0), score(earlier, 0, 0)));

        List<MatchStats> matches = service.getStats(EMAIL, GROUP_ID).matches();

        assertEquals(List.of(4L, 5L), matches.stream().map(MatchStats::matchId).toList());
    }

    private MatchPrediction by(UserAccount user, MatchPrediction prediction) {
        prediction.setPrediction(Prediction.builder().user(user).edition(edition).build());
        return prediction;
    }

    @Test
    @DisplayName("Los votantes de cada signo solo se ven en partidos cerrados y solo de miembros actuales")
    void votersOnlyForLockedMatchesAndCurrentMembers() {
        UserAccount ana = UserAccount.builder().id(1L).participantName("Ana").avatarKey("k1")
                .avatarUpdatedAt(Instant.now()).build();
        UserAccount bea = UserAccount.builder().id(2L).participantName("bea").build();
        UserAccount gone = UserAccount.builder().id(3L).participantName("Ex").build();
        Match started = match(1L, Instant.now().minus(10, ChronoUnit.MINUTES), false, 0, 0);
        started.setStatus(MatchStatusNormalized.LIVE);
        Match future = match(2L, Instant.now().plus(2, ChronoUnit.HOURS), false, null, null);
        when(membershipRepository.findByLeagueId(GROUP_ID)).thenReturn(List.of(
                Membership.builder().user(ana).build(), Membership.builder().user(bea).build()));
        when(matchPredictionRepository.findWithUserByEditionIdAndMatchIds(eq(100L), any())).thenReturn(List.of(
                by(bea, score(started, 2, 0)), by(ana, signOnly(started, "1")), by(gone, score(started, 0, 1)),
                by(ana, score(future, 1, 1))));

        List<MatchVotersDTO> voters = service.getVoters(EMAIL, GROUP_ID, List.of(1L, 2L));

        assertEquals(1, voters.size());
        assertEquals(1L, voters.get(0).matchId());
        assertEquals(List.of("Ana", "bea"), voters.get(0).home().stream().map(MatchVotersDTO.Voter::name).toList());
        assertEquals("/api/users/1/avatar/k1", voters.get(0).home().get(0).avatarUrl());
        assertTrue(voters.get(0).draw().isEmpty());
        assertTrue(voters.get(0).away().isEmpty());
    }

    @Test
    @DisplayName("Pedir votantes de demasiados partidos a la vez es un error y no consulta nada")
    void votersRejectTooManyMatches() {
        List<Long> ids = java.util.stream.LongStream.rangeClosed(1, MatchdayStatsService.MAX_VOTER_MATCHES + 1)
                .boxed().toList();

        assertThrows(BusinessException.class, () -> service.getVoters(EMAIL, GROUP_ID, ids));
        verifyNoInteractions(matchPredictionRepository, groupService);
    }

    @Test
    @DisplayName("En una liga de cuadro cada miembro aparece bajo el equipo que pasa en su cuadro, solo en cruces cerrados")
    void bracketVotersFollowEachPickedWinner() {
        League league = edition.getLeague();
        Competition competition = Competition.builder().id(7L).ownerLeague(league).build();
        edition.setCompetition(competition);
        edition.setPoolFormat(PoolFormat.FULL_BRACKET);
        Team t3 = Team.builder().id(3L).name("T1").build();
        Team t4 = Team.builder().id(4L).name("G2").build();
        Match first = match(1L, Instant.now().plus(1, ChronoUnit.HOURS), false, null, null);
        first.setRound("bracket-1");
        Match second = Match.builder().id(2L).homeTeam(t3).awayTeam(t4).round("bracket-1")
                .matchDate(Instant.now().plus(1, ChronoUnit.HOURS)).finished(false)
                .status(MatchStatusNormalized.SCHEDULED).build();
        when(matchRepository.findByCompetitionId(7L)).thenReturn(List.of(second, first));
        when(customLockService.state(edition)).thenReturn(new CustomLockService.LockState(null, 0, null,
                List.of(), List.of(List.of(true, false)), true, false, null));
        UserAccount ana = UserAccount.builder().id(1L).participantName("Ana").build();
        UserAccount bea = UserAccount.builder().id(2L).participantName("Bea").build();
        UserAccount gone = UserAccount.builder().id(3L).participantName("Ex").build();
        when(membershipRepository.findByLeagueId(GROUP_ID)).thenReturn(List.of(
                Membership.builder().user(ana).build(), Membership.builder().user(bea).build()));
        when(predictionRepository.findByEditionLeagueIdWithUserAndEdition(GROUP_ID)).thenReturn(List.of(
                bracket(ana, "Real Madrid", "T1"), bracket(bea, "Barcelona", "G2"), bracket(gone, "Barcelona", "T1")));

        List<MatchVotersDTO> voters = service.getVoters(EMAIL, GROUP_ID, List.of(1L, 2L));

        assertEquals(1, voters.size());
        assertEquals(1L, voters.get(0).matchId());
        assertEquals(List.of("Ana"), voters.get(0).home().stream().map(MatchVotersDTO.Voter::name).toList());
        assertEquals(List.of("Bea"), voters.get(0).away().stream().map(MatchVotersDTO.Voter::name).toList());
        assertTrue(voters.get(0).draw().isEmpty());
    }

    @Test
    @DisplayName("Si el cuadro del miembro llega a la ronda por otro camino, cuenta el equipo que tiene pasando")
    void bracketSideFallsBackToTheRoundPicks() {
        List<List<String>> picks = List.of(List.of("A", "B", "C", "D"), List.of("C", "A", "E"));

        assertEquals("1", MatchdayStatsService.bracketSide(picks, 1, 0, "A", "D"));
        assertEquals("2", MatchdayStatsService.bracketSide(picks, 1, 1, "B", "C"));
        assertNull(MatchdayStatsService.bracketSide(picks, 1, 2, "A", "C"));
        assertNull(MatchdayStatsService.bracketSide(picks, 2, 0, "A", "C"));
    }

    private Prediction bracket(UserAccount user, String... firstRound) {
        PredictionDataDTO data = new PredictionDataDTO();
        data.setCustomRounds(List.of(List.of(firstRound)));
        return Prediction.builder().user(user).edition(edition).bracketData(data).build();
    }
}
