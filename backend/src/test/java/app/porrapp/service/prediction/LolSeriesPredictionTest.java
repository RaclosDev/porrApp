package app.porrapp.service.prediction;

import app.porrapp.dto.MatchPredictionItemDTO;
import app.porrapp.dto.MatchdayFixturePredictionDTO;
import app.porrapp.exception.BusinessException;
import app.porrapp.model.*;
import app.porrapp.repository.*;
import app.porrapp.scoring.MatchScoringCalculator;
import app.porrapp.scoring.ScoringRuleSet;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** Series del LoL por jornadas: ganador y, si se quiere, el resultado de la serie según su Bo. */
@ExtendWith(MockitoExtension.class)
class LolSeriesPredictionTest {

    @Mock private MatchRepository matchRepository;
    @Mock private MatchPredictionRepository matchPredictionRepository;
    @Mock private PredictionRepository predictionRepository;
    @Mock private UserAccountRepository userAccountRepository;
    @Mock private EditionRepository editionRepository;
    @Mock private MembershipRepository membershipRepository;
    @Mock private MatchScoringCalculator matchScoringCalculator;
    @Mock private ScoreInvalidationService scoreInvalidationService;
    @Mock private FightRepository fightRepository;

    @InjectMocks
    private MatchPredictionService service;

    private final UserAccount user = UserAccount.builder().id(1L).googleEmail("player@test.com").participantName("Ana").build();
    private final Team t1 = Team.builder().id(1L).name("T1").build();
    private final Team blg = Team.builder().id(2L).name("BILIBILI GAMING").build();
    private Edition edition;
    private Prediction prediction;

    @BeforeEach
    void setUp() {
        Competition worlds = Competition.builder().id(16L).name("Worlds de League of Legends")
                .externalId("lol.worlds").formatType("TOURNAMENT").build();
        edition = Edition.builder().id(100L).league(League.builder().id(10L).name("LoL").build())
                .competition(worlds).status("ACTIVE").poolFormat(PoolFormat.MATCH_DAY).build();
        prediction = Prediction.builder().id(50L).user(user).edition(edition).name("Porra").build();
        lenient().when(userAccountRepository.findByGoogleEmail("player@test.com")).thenReturn(Optional.of(user));
        lenient().when(membershipRepository.existsById(any(Membership.MembershipId.class))).thenReturn(true);
        lenient().when(editionRepository.findByLeagueIdAndStatus(10L, "ACTIVE")).thenReturn(Optional.of(edition));
        lenient().when(predictionRepository.findByUserGoogleEmailAndEditionLeagueId("player@test.com", 10L))
                .thenReturn(Optional.of(prediction));
    }

    private Match series(int bestOf) {
        return Match.builder().id(200L).competition(edition.getCompetition()).homeTeam(t1).awayTeam(blg)
                .matchDate(Instant.now().plus(1, ChronoUnit.DAYS)).finished(false).round("sf").bestOf(bestOf).build();
    }

    private void save(Match match, Integer home, Integer away, String sign) {
        when(matchRepository.findAllById(List.of(match.getId()))).thenReturn(List.of(match));
        service.saveMatchdayPredictions("player@test.com", 10L, List.of(MatchPredictionItemDTO.builder()
                .matchId(match.getId()).homeScore(home).awayScore(away).sign(sign).build()));
    }

    private MatchPrediction predicted(Match match, Integer home, Integer away, String sign) {
        MatchPrediction pick = MatchPrediction.builder().id(1L).prediction(prediction).match(match)
                .homeScore(home).awayScore(away).predictionSign(sign).build();
        when(matchPredictionRepository.findByMatchId(match.getId())).thenReturn(List.of(pick));
        return pick;
    }

    private static void finish(Match match, int home, int away) {
        match.setFinished(true);
        match.setStatus(MatchStatusNormalized.FINISHED);
        match.setHomeScore(home);
        match.setAwayScore(away);
    }

    @Test
    void savesTheSeriesResultOfABestOfFive() {
        save(series(5), 1, 3, null);

        verify(matchPredictionRepository).save(argThat(pick -> "2".equals(pick.getPredictionSign())
                && pick.getHomeScore() == 1 && pick.getAwayScore() == 3));
    }

    @Test
    void savesTheWinnerAlone() {
        save(series(3), null, null, "1");

        verify(matchPredictionRepository).save(argThat(pick -> "1".equals(pick.getPredictionSign())
                && pick.getHomeScore() == null));
    }

    @ParameterizedTest
    @CsvSource({"2, 1", "3, 3", "4, 1", "2, 2", "0, 0"})
    void rejectsResultsThatCannotHappenInABestOfFive(int home, int away) {
        Match match = series(5);
        assertThrows(BusinessException.class, () -> save(match, home, away, null));
        verify(matchPredictionRepository, never()).save(any());
    }

    @Test
    void aBestOfOneOnlyTakesTheWinner() {
        Match match = series(1);
        BusinessException error = assertThrows(BusinessException.class, () -> save(match, 1, 0, null));
        assertTrue(error.getMessage().contains("solo se elige quién gana"));
    }

    @Test
    void theExactSeriesScoresTheExactResultInsteadOfTheWinner() {
        Match match = series(5);
        finish(match, 3, 1);
        MatchPrediction pick = predicted(match, 3, 1, "1");

        service.evaluatePredictionsForMatch(match);

        assertEquals(ScoringRuleSet.defaults().getExactScorePoints(), pick.getPointsAwarded());
        assertTrue(pick.getIsExactScore());
        assertEquals("Ganador y resultado de la serie acertados, 3-1 (5 pts)", pick.getScoringDetails());
    }

    @Test
    void theWinnerWithAnotherResultScoresTheWinner() {
        Match match = series(5);
        finish(match, 3, 2);
        MatchPrediction pick = predicted(match, 3, 0, "1");

        service.evaluatePredictionsForMatch(match);

        assertEquals(ScoringRuleSet.defaults().getCorrectSignPoints(), pick.getPointsAwarded());
        assertFalse(pick.getIsExactScore());
        assertEquals("Ganador acertado (3 pts)", pick.getScoringDetails());
    }

    @Test
    void theWrongWinnerScoresNothing() {
        Match match = series(3);
        finish(match, 0, 2);
        MatchPrediction pick = predicted(match, null, null, "1");

        service.evaluatePredictionsForMatch(match);

        assertEquals(0, pick.getPointsAwarded());
    }

    @Test
    void aGameAheadIsNotASeriesWin() {
        Match live = series(5);
        live.setStatus(MatchStatusNormalized.LIVE);
        live.setHomeScore(1);
        live.setAwayScore(0);

        service.evaluatePredictionsForMatch(live);

        verify(matchPredictionRepository, never()).findByMatchId(any());
        verify(matchPredictionRepository, never()).save(any());
    }

    @Test
    void fixturesTellTheBestOfAndHowManyGamesWinTheSeries() {
        Match bo5 = series(5);
        Match bo1 = Match.builder().id(201L).competition(edition.getCompetition()).homeTeam(blg).awayTeam(t1)
                .matchDate(Instant.now().plus(2, ChronoUnit.DAYS)).finished(false).round("group").bestOf(1).build();
        when(matchRepository.findByCompetitionIdOrderByMatchDateAsc(16L)).thenReturn(List.of(bo5, bo1));

        List<MatchdayFixturePredictionDTO> fixtures = service.getMatchdayFixtures("player@test.com", 10L, null);

        assertEquals(5, fixtures.get(0).getBestOf());
        assertEquals(3, fixtures.get(0).getSetsToWin(), "al mejor de cinco se gana con tres partidas");
        assertEquals(1, fixtures.get(1).getBestOf());
        assertNull(fixtures.get(1).getSetsToWin(), "al mejor de uno solo se elige quién gana");
    }

    @Test
    void survivorPicksATeamWithoutTheSeriesResult() {
        edition.setPoolFormat(PoolFormat.SURVIVOR);
        when(matchRepository.findByCompetitionIdOrderByMatchDateAsc(16L)).thenReturn(List.of(series(5)));

        MatchdayFixturePredictionDTO fixture = service.getMatchdayFixtures("player@test.com", 10L, null).get(0);

        assertNull(fixture.getSetsToWin());
        assertEquals(5, fixture.getBestOf());
    }
}
