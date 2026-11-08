package com.porra.mundial.service.prediction;

import com.porra.mundial.dto.MatchPredictionItemDTO;
import com.porra.mundial.dto.ParticipantScoreDTO;
import com.porra.mundial.dto.PredictionDataDTO;
import com.porra.mundial.dto.SurvivorStatusDTO;
import com.porra.mundial.exception.BusinessException;
import com.porra.mundial.model.*;
import com.porra.mundial.repository.*;
import com.porra.mundial.scoring.MatchScoringCalculator;
import com.porra.mundial.scoring.ScoringRuleSet;
import com.porra.mundial.scoring.DefaultScoringStrategy;
import com.porra.mundial.service.tournament.OfficialResultsService;
import com.porra.mundial.service.tournament.TopScorerService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/** Modo superviviente: un equipo por jornada, sin repetir, y fuera al primer fallo. */
class SurvivorModeTest {

    private static final Team MADRID = Team.builder().id(1L).name("Real Madrid").build();
    private static final Team BARCA = Team.builder().id(2L).name("Barcelona").build();
    private static final Team BETIS = Team.builder().id(3L).name("Betis").build();
    private static final Team SEVILLA = Team.builder().id(4L).name("Sevilla").build();

    private static Match match(long id, String round, Team home, Team away, Instant date) {
        return Match.builder().id(id).round(round).homeTeam(home).awayTeam(away).matchDate(date)
                .competition(Competition.builder().id(2L).build()).finished(false).build();
    }

    private static Match played(long id, String round, Team home, Team away, int homeGoals, int awayGoals, Instant date) {
        Match match = match(id, round, home, away, date);
        match.setFinished(true);
        match.setHomeScore(homeGoals);
        match.setAwayScore(awayGoals);
        return match;
    }

    private static MatchPrediction pick(Prediction prediction, Match match, String sign) {
        return MatchPrediction.builder().prediction(prediction).match(match).predictionSign(sign).build();
    }

    @Nested
    @DisplayName("Reglas")
    class Rules {
        private final Instant day = Instant.parse("2026-10-01T18:00:00Z");

        @Test
        void winningPickSurvivesAndDrawEliminates() {
            assertEquals(1, SurvivorRules.score("1", 2, 0, MADRID).totalPoints());
            assertEquals(1, SurvivorRules.score("2", 0, 1, BARCA).totalPoints());
            assertEquals(0, SurvivorRules.score("1", 1, 1, MADRID).totalPoints());
            assertEquals(0, SurvivorRules.score("2", 3, 1, BARCA).totalPoints());
        }

        @Test
        void standingCountsRoundsUntilFirstFailureInDateOrder() {
            List<MatchPrediction> picks = List.of(
                    pick(null, played(3, "Jornada 3", BETIS, SEVILLA, 2, 0, day.plus(14, ChronoUnit.DAYS)), "1"),
                    pick(null, played(1, "Jornada 1", MADRID, BETIS, 3, 0, day), "1"),
                    pick(null, played(2, "Jornada 2", BARCA, SEVILLA, 1, 1, day.plus(7, ChronoUnit.DAYS)), "1"));

            SurvivorRules.Standing standing = SurvivorRules.standing(picks);

            assertEquals(1, standing.survived());
            assertTrue(standing.eliminated());
            assertEquals(day.plus(7, ChronoUnit.DAYS), standing.eliminatedAt());
        }

        @Test
        void leagueSettingsChangePointsLivesAndDraws() {
            SurvivorRules.Settings settings = new SurvivorRules.Settings(3, 2, true);
            assertEquals(3, SurvivorRules.score("1", 2, 0, MADRID, settings).totalPoints());
            // El empate salva y cuenta como jornada superada.
            assertEquals(3, SurvivorRules.score("1", 1, 1, MADRID, settings).totalPoints());

            List<MatchPrediction> picks = List.of(
                    pick(null, played(1, "Jornada 1", MADRID, BETIS, 1, 1, day), "1"),
                    pick(null, played(2, "Jornada 2", BARCA, SEVILLA, 0, 1, day.plus(7, ChronoUnit.DAYS)), "1"),
                    pick(null, played(3, "Jornada 3", BETIS, SEVILLA, 2, 0, day.plus(14, ChronoUnit.DAYS)), "1"),
                    pick(null, played(4, "Jornada 4", SEVILLA, MADRID, 2, 0, day.plus(21, ChronoUnit.DAYS)), "2"));

            // Con dos vidas, la derrota de la Jornada 2 solo resta una; la de la Jornada 4 elimina.
            SurvivorRules.Standing standing = SurvivorRules.standing(picks, List.of(), null, null, settings);
            assertEquals(2, standing.survived());
            assertTrue(standing.eliminated());
            assertEquals("Jornada 4", standing.eliminatedRound());
            assertEquals(0, standing.livesLeft());

            SurvivorRules.Standing afterThree = SurvivorRules.standing(picks.subList(0, 3), List.of(), null, null, settings);
            assertFalse(afterThree.eliminated());
            assertEquals(1, afterThree.livesLeft());
        }

        @Test
        void livesAndDrawRuleAreValidated() {
            tools.jackson.databind.ObjectMapper json = new tools.jackson.databind.ObjectMapper();
            assertThrows(BusinessException.class, () -> ScoringRuleSet.fromRequest(json.readTree("{\"survivorLives\": 0}")));
            assertThrows(BusinessException.class, () -> ScoringRuleSet.fromRequest(json.readTree("{\"survivorLives\": 11}")));
            assertThrows(BusinessException.class, () -> ScoringRuleSet.fromRequest(json.readTree("{\"survivorDrawSurvives\": 2}")));
            assertEquals(3, ScoringRuleSet.fromRequest(json.readTree("{\"survivorLives\": 3}")).getSurvivorLives());
        }

        @Test
        void leaguesWithoutSurvivorSettingsKeepTheClassicRules() {
            SurvivorRules.Settings settings = SurvivorRules.Settings.of(ScoringRuleSet.fromJson("{\"correctSignPoints\": 3}"));
            assertEquals(SurvivorRules.Settings.DEFAULT, settings);
        }

        @Test
        void unfinishedPicksDoNotDecideAnything() {
            Match live = match(1, "Jornada 1", MADRID, BETIS, day);
            live.setHomeScore(0);
            live.setAwayScore(2);
            live.setStatus(MatchStatusNormalized.LIVE);

            SurvivorRules.Standing standing = SurvivorRules.standing(List.of(pick(null, live, "1")));

            assertEquals(0, standing.survived());
            assertFalse(standing.eliminated());
        }

        @Test
        void aRoundWithoutAPickEliminatesOnceAllItsMatchesHaveStarted() {
            Match j1a = played(1, "Jornada 1", MADRID, BETIS, 2, 0, day);
            Match j2a = match(2, "Jornada 2", BARCA, SEVILLA, day.plus(7, ChronoUnit.DAYS));
            Match j2b = match(3, "Jornada 2", BETIS, MADRID, day.plus(8, ChronoUnit.DAYS));
            List<MatchPrediction> picks = List.of(pick(null, j1a, "1"));
            List<Match> calendar = List.of(j1a, j2a, j2b);
            Instant joined = day.minus(1, ChronoUnit.DAYS);

            // Con un partido de la Jornada 2 aún por empezar, todavía puede elegir.
            SurvivorRules.Standing open = SurvivorRules.standing(picks, calendar, joined, day.plus(7, ChronoUnit.DAYS).plusSeconds(60));
            assertFalse(open.eliminated());
            assertEquals(1, open.survived());

            SurvivorRules.Standing closed = SurvivorRules.standing(picks, calendar, joined, day.plus(8, ChronoUnit.DAYS));
            assertTrue(closed.eliminated());
            assertTrue(closed.missed());
            assertEquals("Jornada 2", closed.eliminatedRound());
            assertEquals(1, closed.survived());
        }

        @Test
        void roundsThatStartedBeforeJoiningDoNotCount() {
            Match j1 = played(1, "Jornada 1", MADRID, BETIS, 2, 0, day);
            Match j2 = match(2, "Jornada 2", BARCA, SEVILLA, day.plus(7, ChronoUnit.DAYS));

            SurvivorRules.Standing standing = SurvivorRules.standing(List.of(), List.of(j1, j2),
                    day.plus(1, ChronoUnit.DAYS), day.plus(3, ChronoUnit.DAYS));

            assertFalse(standing.eliminated());
        }
    }

    @Nested
    @DisplayName("Guardar elecciones")
    @ExtendWith(MockitoExtension.class)
    @MockitoSettings(strictness = Strictness.LENIENT)
    class Saving {
        @Mock MatchRepository matchRepository;
        @Mock MatchPredictionRepository matchPredictionRepository;
        @Mock PredictionRepository predictionRepository;
        @Mock UserAccountRepository userAccountRepository;
        @Mock EditionRepository editionRepository;
        @Mock MembershipRepository membershipRepository;
        @Mock MatchScoringCalculator matchScoringCalculator;
        @Mock ScoreInvalidationService scoreInvalidationService;
        @InjectMocks MatchPredictionService service;

        private final Instant soon = Instant.now().plus(2, ChronoUnit.DAYS);
        private Prediction prediction;
        private Match round5;
        private Match otherRound5;

        @BeforeEach
        void setUp() {
            UserAccount user = UserAccount.builder().id(1L).googleEmail("p@test.com").participantName("P").build();
            Edition edition = Edition.builder().id(100L).league(League.builder().id(10L).build())
                    .competition(Competition.builder().id(2L).build()).status("ACTIVE")
                    .poolFormat(PoolFormat.SURVIVOR)
                    .scoringRulesJson(ScoringRuleSet.defaults().toJson()).build();
            prediction = Prediction.builder().id(50L).user(user).edition(edition).build();
            round5 = match(501, "Jornada 5", MADRID, BETIS, soon);
            otherRound5 = match(502, "Jornada 5", BARCA, SEVILLA, soon.plus(1, ChronoUnit.HOURS));

            when(userAccountRepository.findByGoogleEmail("p@test.com")).thenReturn(Optional.of(user));
            when(membershipRepository.existsById(any())).thenReturn(true);
            when(editionRepository.findByLeagueIdAndStatus(10L, "ACTIVE")).thenReturn(Optional.of(edition));
            when(predictionRepository.findByUserGoogleEmailAndEditionLeagueId("p@test.com", 10L))
                    .thenReturn(Optional.of(prediction));
            when(matchRepository.findAllById(any())).thenAnswer(invocation -> {
                Iterable<Long> ids = invocation.getArgument(0);
                List<Long> list = new java.util.ArrayList<>();
                ids.forEach(list::add);
                return java.util.stream.Stream.of(round5, otherRound5).filter(m -> list.contains(m.getId())).toList();
            });
        }

        private int save(long matchId, String sign) {
            return service.saveMatchdayPredictions("p@test.com", 10L,
                    List.of(MatchPredictionItemDTO.builder().matchId(matchId).sign(sign).build()));
        }

        private void existing(MatchPrediction... picks) {
            when(matchPredictionRepository.findWithMatchByPredictionIdIn(List.of(50L))).thenReturn(List.of(picks));
        }

        @Test
        void savesAWinnerPick() {
            existing();

            assertEquals(1, save(501, "1"));

            ArgumentCaptor<MatchPrediction> saved = ArgumentCaptor.forClass(MatchPrediction.class);
            verify(matchPredictionRepository).save(saved.capture());
            assertEquals("1", saved.getValue().getPredictionSign());
            assertNull(saved.getValue().getHomeScore());
        }

        @Test
        void rejectsDrawAndScores() {
            existing();

            assertThrows(BusinessException.class, () -> save(501, "X"));
            assertThrows(BusinessException.class, () -> service.saveMatchdayPredictions("p@test.com", 10L,
                    List.of(MatchPredictionItemDTO.builder().matchId(501L).homeScore(2).awayScore(0).build())));
        }

        @Test
        void rejectsATeamAlreadyUsedInAnotherRound() {
            Match round4 = played(401, "Jornada 4", BETIS, MADRID, 0, 2, Instant.now().minus(5, ChronoUnit.DAYS));
            existing(pick(prediction, round4, "2"));

            BusinessException error = assertThrows(BusinessException.class, () -> save(501, "1"));
            assertTrue(error.getMessage().contains("Real Madrid"));
            assertTrue(error.getMessage().endsWith(" en Jornada 4."), error.getMessage());
            verify(matchPredictionRepository, never()).save(any());
        }

        @Test
        void inTheNflTheRepeatedTeamMessageSpeaksOfWeeks() {
            Match week4 = played(401, "Semana 4", BETIS, MADRID, 0, 2, Instant.now().minus(5, ChronoUnit.DAYS));
            existing(pick(prediction, week4, "2"));

            BusinessException error = assertThrows(BusinessException.class, () -> save(501, "1"));
            assertTrue(error.getMessage().endsWith(" en la Semana 4."), error.getMessage());
        }

        @Test
        void choosingAnotherMatchOfTheSameRoundReplacesTheOpenPick() {
            MatchPrediction previous = pick(prediction, otherRound5, "1");
            existing(previous);

            assertEquals(1, save(501, "1"));

            verify(matchPredictionRepository).delete(previous);
        }

        @Test
        void aClosedPickOfTheRoundCannotBeReplaced() {
            Match started = match(503, "Jornada 5", BARCA, SEVILLA, Instant.now().minus(10, ChronoUnit.MINUTES));
            existing(pick(prediction, started, "1"));

            assertThrows(BusinessException.class, () -> save(501, "1"));
            verify(matchPredictionRepository, never()).delete(any());
        }

        @Test
        void anEliminatedPlayerCannotPickAgain() {
            existing(pick(prediction, played(401, "Jornada 4", BETIS, MADRID, 1, 1,
                    Instant.now().minus(5, ChronoUnit.DAYS)), "2"));

            assertThrows(BusinessException.class, () -> save(501, "1"));
        }

        @Test
        void statusListsPicksAndUsedTeams() {
            existing(pick(prediction, played(401, "Jornada 4", BETIS, MADRID, 0, 2,
                    Instant.now().minus(5, ChronoUnit.DAYS)), "2"), pick(prediction, round5, "1"));

            SurvivorStatusDTO status = service.getSurvivorStatus("p@test.com", 10L);

            assertFalse(status.eliminated());
            assertEquals(1, status.survived());
            assertEquals(List.of("WON", "PENDING"), status.picks().stream().map(SurvivorStatusDTO.Pick::result).toList());
            assertEquals(List.of(1L, 1L), status.picks().stream().map(SurvivorStatusDTO.Pick::teamId).toList());
        }

        @Test
        void skippingAClosedRoundEliminatesAndBlocksNewPicks() {
            Match missed = match(401, "Jornada 4", BETIS, MADRID, Instant.now().minus(5, ChronoUnit.DAYS));
            when(matchRepository.findByCompetitionId(2L)).thenReturn(List.of(missed, round5, otherRound5));
            when(membershipRepository.findById(any())).thenReturn(Optional.of(Membership.builder()
                    .joinedAt(Instant.now().minus(30, ChronoUnit.DAYS)).build()));
            existing();

            SurvivorStatusDTO status = service.getSurvivorStatus("p@test.com", 10L);

            assertTrue(status.eliminated());
            assertTrue(status.missed());
            assertEquals("Jornada 4", status.eliminatedRound());
            assertThrows(BusinessException.class, () -> save(501, "1"));
        }
    }

    @Nested
    @DisplayName("Clasificación")
    @ExtendWith(MockitoExtension.class)
    @MockitoSettings(strictness = Strictness.LENIENT)
    class Leaderboard {
        @Mock PredictionRepository predictionRepository;
        @Mock OfficialResultsService officialResultsService;
        @Mock TopScorerService topScorerService;
        @Mock MatchRepository matchRepository;
        @Mock MatchPredictionRepository matchPredictionRepository;
        @Mock MembershipRepository membershipRepository;
        @Mock EditionRepository editionRepository;
        @Spy DefaultScoringStrategy scoringStrategy = new DefaultScoringStrategy();
        @InjectMocks LeaderboardService leaderboardService;

        @Test
        void aliveBeatsEliminatedWithTheSamePointsAndEliminationIsStored() {
            Instant day = Instant.parse("2026-10-01T18:00:00Z");
            Edition edition = Edition.builder().poolFormat(PoolFormat.SURVIVOR)
                    .competition(Competition.builder().externalId("esp.1").build()).build();
            Prediction alive = Prediction.builder().id(1L).edition(edition)
                    .user(UserAccount.builder().id(11L).participantName("Ana").build()).build();
            Prediction out = Prediction.builder().id(2L).edition(edition)
                    .user(UserAccount.builder().id(12L).participantName("Bea").build()).build();
            Match j1 = played(1, "Jornada 1", MADRID, BETIS, 2, 0, day);
            Match j2 = played(2, "Jornada 2", BARCA, SEVILLA, 0, 1, day.plus(7, ChronoUnit.DAYS));

            when(predictionRepository.findByEditionLeagueIdWithUserAndEdition(10L)).thenReturn(List.of(out, alive));
            when(matchPredictionRepository.findWithMatchByPredictionIdIn(any())).thenReturn(List.of(
                    pick(alive, j1, "1"),
                    pick(out, j1, "1"), pick(out, j2, "1")));
            when(officialResultsService.current()).thenReturn(new OfficialResultsService.OfficialResults(
                    new PredictionDataDTO(), Collections.emptyMap(), Collections.emptyMap(), List.of(),
                    List.of(), List.of(), List.of(), List.of(), null));

            List<ParticipantScoreDTO> board = leaderboardService.getLeaderboard(10L);

            assertEquals(List.of("Ana", "Bea"), board.stream().map(ParticipantScoreDTO::getName).toList());
            assertEquals(List.of(1, 1), board.stream().map(ParticipantScoreDTO::getTotal).toList());
            assertFalse(board.get(0).isEliminated());
            assertTrue(board.get(1).isEliminated());
            verify(predictionRepository).saveSurvivorEliminated(2L, true);
            verify(predictionRepository).saveSurvivorEliminated(1L, false);
            verify(predictionRepository, times(2)).saveSurvivorEliminated(any(), anyBoolean());
            verify(predictionRepository).saveCalculatedScore(eq(2L), eq(1), any(), any(), any(), any(), any(),
                    any(), any(), eq(1), any());
        }

        @Test
        void aMemberWhoNeverPickedFallsAfterAClosedRound() {
            Edition edition = Edition.builder().poolFormat(PoolFormat.SURVIVOR).league(League.builder().id(10L).build())
                    .competition(Competition.builder().id(2L).externalId("esp.1").build()).build();
            UserAccount carla = UserAccount.builder().id(13L).participantName("Carla").build();
            when(predictionRepository.findByEditionLeagueIdWithUserAndEdition(10L)).thenReturn(List.of());
            when(editionRepository.findByLeagueIdAndStatus(10L, "ACTIVE")).thenReturn(Optional.of(edition));
            when(membershipRepository.findByLeagueId(10L)).thenReturn(List.of(Membership.builder()
                    .user(carla).joinedAt(Instant.now().minus(30, ChronoUnit.DAYS)).build()));
            when(membershipRepository.findById(any())).thenReturn(Optional.of(Membership.builder()
                    .joinedAt(Instant.now().minus(30, ChronoUnit.DAYS)).build()));
            when(matchRepository.findByCompetitionId(2L)).thenReturn(List.of(
                    played(1, "Jornada 1", MADRID, BETIS, 2, 0, Instant.now().minus(7, ChronoUnit.DAYS))));

            List<ParticipantScoreDTO> board = leaderboardService.getLeaderboard(10L);

            assertEquals("Carla", board.get(0).getName());
            assertTrue(board.get(0).isEliminated());
        }
    }
}
