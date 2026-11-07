package com.porra.mundial.service.prediction;

import com.porra.mundial.dto.MatchPredictionItemDTO;
import com.porra.mundial.dto.MatchdayFixturePredictionDTO;
import com.porra.mundial.exception.BusinessException;
import com.porra.mundial.model.*;
import com.porra.mundial.repository.*;
import com.porra.mundial.scoring.MatchScoringCalculator;
import com.porra.mundial.scoring.ScoringRuleSet;
import com.porra.mundial.scoring.TennisScoring;
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

/** Partidos de tenis en una liga partido a partido: ganador por ronda, sets de extra y sin empates. */
@ExtendWith(MockitoExtension.class)
class TennisPredictionTest {

    @Mock private MatchRepository matchRepository;
    @Mock private MatchPredictionRepository matchPredictionRepository;
    @Mock private PredictionRepository predictionRepository;
    @Mock private UserAccountRepository userAccountRepository;
    @Mock private EditionRepository editionRepository;
    @Mock private MembershipRepository membershipRepository;
    @Mock private MatchScoringCalculator matchScoringCalculator;
    @Mock private ScoreInvalidationService scoreInvalidationService;

    @InjectMocks
    private MatchPredictionService service;

    private final UserAccount user = UserAccount.builder().id(1L).googleEmail("player@test.com").participantName("Ana").build();
    private final Team sinner = Team.builder().id(1L).name("Jannik Sinner").build();
    private final Team alcaraz = Team.builder().id(2L).name("Carlos Alcaraz").build();
    private Edition edition;
    private Prediction prediction;

    @BeforeEach
    void setUp() {
        Competition rolandGarros = Competition.builder().id(30L).name("Roland Garros · masculino")
                .externalId("tennis.atp.172").formatType("TOURNAMENT").build();
        edition = Edition.builder().id(100L).league(League.builder().id(10L).name("Tenis").build())
                .competition(rolandGarros).status("ACTIVE").poolFormat(PoolFormat.MATCH_DAY)
                .scoringRulesJson(ScoringRuleSet.defaultTennis().toJson()).build();
        prediction = Prediction.builder().id(50L).user(user).edition(edition).name("Porra").build();
        lenient().when(userAccountRepository.findByGoogleEmail("player@test.com")).thenReturn(Optional.of(user));
        lenient().when(membershipRepository.existsById(any(Membership.MembershipId.class))).thenReturn(true);
        lenient().when(editionRepository.findByLeagueIdAndStatus(10L, "ACTIVE")).thenReturn(Optional.of(edition));
        lenient().when(predictionRepository.findByUserGoogleEmailAndEditionLeagueId("player@test.com", 10L))
                .thenReturn(Optional.of(prediction));
    }

    private Match match(String round) {
        return Match.builder().id(200L).competition(edition.getCompetition()).homeTeam(sinner).awayTeam(alcaraz)
                .matchDate(Instant.now().plus(1, ChronoUnit.DAYS)).finished(false).round(round).build();
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

    @Test
    void savesAWinnerWithItsSets() {
        save(match("r16"), 3, 1, null);

        verify(matchPredictionRepository).save(argThat(pick -> "1".equals(pick.getPredictionSign())
                && pick.getHomeScore() == 3 && pick.getAwayScore() == 1));
    }

    @Test
    void savesAWinnerWithoutSets() {
        save(match("r16"), null, null, "2");

        verify(matchPredictionRepository).save(argThat(pick -> "2".equals(pick.getPredictionSign())));
    }

    @Test
    void thereAreNoDrawsInTennis() {
        Match match = match("qf");
        BusinessException error = assertThrows(BusinessException.class, () -> save(match, null, null, "X"));
        assertTrue(error.getMessage().contains("no hay empate"));
        verify(matchPredictionRepository, never()).save(any());
    }

    @ParameterizedTest
    @CsvSource({"2, 1", "3, 3", "4, 1", "1, 1"})
    void rejectsSetResultsThatCannotHappenInABestOfFive(int home, int away) {
        Match match = match("qf");
        assertThrows(BusinessException.class, () -> save(match, home, away, null));
        verify(matchPredictionRepository, never()).save(any());
    }

    @Test
    void theWinnerScoresByRoundAndTheExactSetsAddTheBonus() {
        Match finalMatch = match("final");
        finalMatch.setFinished(true);
        finalMatch.setHomeScore(3);
        finalMatch.setAwayScore(1);
        finalMatch.setWinnerTeam(sinner);
        MatchPrediction pick = predicted(finalMatch, 3, 1, "1");

        service.evaluatePredictionsForMatch(finalMatch);

        ScoringRuleSet rules = ScoringRuleSet.defaultTennis();
        assertEquals(rules.getChampionPoints() + rules.getExactScorePoints(), pick.getPointsAwarded());
        assertTrue(pick.getIsExactScore());
    }

    @Test
    void theWinnerAloneScoresTheRoundPoints() {
        Match quarter = match("qf");
        quarter.setFinished(true);
        quarter.setHomeScore(1);
        quarter.setAwayScore(3);
        quarter.setWinnerTeam(alcaraz);
        MatchPrediction pick = predicted(quarter, 2, 3, "2");

        service.evaluatePredictionsForMatch(quarter);

        assertEquals(ScoringRuleSet.defaultTennis().getQuarterFinalPoints(), pick.getPointsAwarded());
        assertFalse(pick.getIsExactScore());
        assertEquals("Ganador acertado (15 pts)", pick.getScoringDetails());
    }

    @Test
    void aWalkoverCountsTheWinnerWithoutScore() {
        Match walkover = match("r16");
        walkover.setFinished(true);
        walkover.setStatus(MatchStatusNormalized.FINISHED);
        walkover.setWinnerTeam(alcaraz);
        MatchPrediction pick = predicted(walkover, 0, 3, "2");

        service.evaluatePredictionsForMatch(walkover);

        assertEquals(ScoringRuleSet.defaultTennis().getRoundOf16Points(), pick.getPointsAwarded());
    }

    @Test
    void aSetAheadIsNotAWinYet() {
        Match live = match("sf");
        live.setStatus(MatchStatusNormalized.LIVE);
        live.setHomeScore(1);
        live.setAwayScore(0);

        service.evaluatePredictionsForMatch(live);

        verify(matchPredictionRepository, never()).findByMatchId(any());
        verify(matchPredictionRepository, never()).save(any());
    }

    @Test
    void fixturesTellHowManySetsWinAMatchAndWhoWon() {
        Match walkover = match("r16");
        walkover.setFinished(true);
        walkover.setWinnerTeam(alcaraz);
        when(matchRepository.findByCompetitionIdOrderByMatchDateAsc(30L)).thenReturn(List.of(walkover));

        MatchdayFixturePredictionDTO fixture = service.getMatchdayFixtures("player@test.com", 10L, null).get(0);

        assertEquals(3, fixture.getSetsToWin(), "Grand Slam masculino: al mejor de cinco");
        assertEquals("2", fixture.getWinnerSign());
        assertEquals("Octavos de final", fixture.getRound());
    }

    @ParameterizedTest
    @CsvSource({"2, 0, 2, true", "1, 2, 2, true", "2, 2, 2, false", "3, 2, 2, false", "3, 2, 3, true", "0, 2, 3, false"})
    void validSetResults(int home, int away, int setsToWin, boolean valid) {
        assertEquals(valid, TennisScoring.validSets(home, away, setsToWin));
    }
}
