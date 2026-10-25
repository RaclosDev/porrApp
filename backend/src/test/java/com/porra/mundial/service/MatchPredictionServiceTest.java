package com.porra.mundial.service;

import com.porra.mundial.dto.MatchPredictionItemDTO;
import com.porra.mundial.dto.MatchdayFixturePredictionDTO;
import com.porra.mundial.model.*;
import com.porra.mundial.repository.*;
import com.porra.mundial.scoring.MatchScoreResult;
import com.porra.mundial.scoring.MatchScoringCalculator;
import com.porra.mundial.scoring.ScoringRuleSet;
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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MatchPredictionServiceTest {

    @Mock
    private MatchRepository matchRepository;

    @Mock
    private MatchPredictionRepository matchPredictionRepository;

    @Mock
    private PredictionRepository predictionRepository;

    @Mock
    private UserAccountRepository userAccountRepository;

    @Mock
    private EditionRepository editionRepository;

    @Mock
    private MembershipRepository membershipRepository;

    @Mock
    private MatchScoringCalculator matchScoringCalculator;

    @InjectMocks
    private MatchPredictionService matchPredictionService;

    private UserAccount user;
    private League league;
    private Edition edition;
    private Match futureMatch;
    private Match pastMatch;
    private Match finishedMatch;

    @BeforeEach
    void setUp() {
        user = UserAccount.builder()
                .id(1L)
                .googleEmail("player@test.com")
                .participantName("Player 1")
                .build();

        league = League.builder()
                .id(10L)
                .name("Liga Fantástica")
                .build();

        edition = Edition.builder()
                .id(100L)
                .league(league)
                .status("ACTIVE")
                .scoringRulesJson(ScoringRuleSet.defaultWorldCup2026().toJson())
                .build();

        Team home = Team.builder().id(1L).name("España").build();
        Team away = Team.builder().id(2L).name("Alemania").build();

        futureMatch = Match.builder()
                .id(101L)
                .homeTeam(home)
                .awayTeam(away)
                .matchDate(LocalDateTime.now().plusDays(2))
                .finished(false)
                .round("Jornada 1")
                .build();

        pastMatch = Match.builder()
                .id(102L)
                .homeTeam(home)
                .awayTeam(away)
                .matchDate(LocalDateTime.now().minusHours(1))
                .finished(false)
                .round("Jornada 1")
                .build();

        finishedMatch = Match.builder()
                .id(103L)
                .homeTeam(home)
                .awayTeam(away)
                .matchDate(LocalDateTime.now().minusDays(1))
                .finished(true)
                .homeScore(2)
                .awayScore(1)
                .round("Jornada 1")
                .build();
    
        lenient().when(membershipRepository.existsById(any(Membership.MembershipId.class))).thenReturn(true);
    }

    @Test
    @DisplayName("getMatchdayFixtures marca como bloqueados los partidos pasados o finalizados y abiertos los futuros")
    void getMatchdayFixtures_MarksLockStatusesCorrectly() {
        when(editionRepository.findByLeagueIdAndStatus(10L, "ACTIVE")).thenReturn(Optional.of(edition));
        when(matchRepository.findAll()).thenReturn(List.of(futureMatch, pastMatch, finishedMatch));
        when(predictionRepository.findByUserGoogleEmailAndEditionLeagueId("player@test.com", 10L)).thenReturn(Optional.empty());

        List<MatchdayFixturePredictionDTO> fixtures = matchPredictionService.getMatchdayFixtures("player@test.com", 10L, null);

        assertEquals(3, fixtures.size());

        MatchdayFixturePredictionDTO futDto = fixtures.stream().filter(f -> f.getMatchId().equals(101L)).findFirst().orElseThrow();
        assertFalse(futDto.isLocked(), "El partido futuro debe estar abierto para pronósticos");

        MatchdayFixturePredictionDTO pastDto = fixtures.stream().filter(f -> f.getMatchId().equals(102L)).findFirst().orElseThrow();
        assertTrue(pastDto.isLocked(), "El partido cuya hora ya pasó debe estar bloqueado");

        MatchdayFixturePredictionDTO finDto = fixtures.stream().filter(f -> f.getMatchId().equals(103L)).findFirst().orElseThrow();
        assertTrue(finDto.isLocked(), "El partido finalizado debe estar bloqueado");
    }

    @Test
    @DisplayName("saveMatchdayPredictions guarda pronósticos válidos para partidos futuros")
    void saveMatchdayPredictions_SuccessForFutureMatches() {
        when(userAccountRepository.findByGoogleEmail("player@test.com")).thenReturn(Optional.of(user));
        when(editionRepository.findByLeagueIdAndStatus(10L, "ACTIVE")).thenReturn(Optional.of(edition));

        Prediction userPred = Prediction.builder().id(50L).user(user).edition(edition).name("Porra").build();
        when(predictionRepository.findByUserGoogleEmailAndEditionLeagueId("player@test.com", 10L)).thenReturn(Optional.of(userPred));
        when(matchRepository.findById(101L)).thenReturn(Optional.of(futureMatch));
        when(matchPredictionRepository.findByPredictionIdAndMatchId(50L, 101L)).thenReturn(Optional.empty());

        MatchPredictionItemDTO item = MatchPredictionItemDTO.builder()
                .matchId(101L)
                .homeScore(2)
                .awayScore(1)
                .sign("1")
                .build();

        int saved = matchPredictionService.saveMatchdayPredictions("player@test.com", 10L, List.of(item));

        assertEquals(1, saved);
        verify(matchPredictionRepository, times(1)).save(any(MatchPrediction.class));
    }

    @Test
    @DisplayName("saveMatchdayPredictions rechaza modificar un partido que ya ha comenzado")
    void saveMatchdayPredictions_ThrowsExceptionIfMatchAlreadyStarted() {
        when(userAccountRepository.findByGoogleEmail("player@test.com")).thenReturn(Optional.of(user));
        when(editionRepository.findByLeagueIdAndStatus(10L, "ACTIVE")).thenReturn(Optional.of(edition));

        Prediction userPred = Prediction.builder().id(50L).user(user).edition(edition).name("Porra").build();
        when(predictionRepository.findByUserGoogleEmailAndEditionLeagueId("player@test.com", 10L)).thenReturn(Optional.of(userPred));
        when(matchRepository.findById(102L)).thenReturn(Optional.of(pastMatch));

        MatchPredictionItemDTO item = MatchPredictionItemDTO.builder()
                .matchId(102L)
                .homeScore(1)
                .awayScore(1)
                .build();

        IllegalStateException ex = assertThrows(IllegalStateException.class, () ->
                matchPredictionService.saveMatchdayPredictions("player@test.com", 10L, List.of(item)));

        assertTrue(ex.getMessage().contains("ya ha comenzado"));
        verify(matchPredictionRepository, never()).save(any(MatchPrediction.class));
    }

    @Test
    @DisplayName("saveMatchdayPredictions rechaza modificar un partido finalizado")
    void saveMatchdayPredictions_ThrowsExceptionIfMatchFinished() {
        when(userAccountRepository.findByGoogleEmail("player@test.com")).thenReturn(Optional.of(user));
        when(editionRepository.findByLeagueIdAndStatus(10L, "ACTIVE")).thenReturn(Optional.of(edition));

        Prediction userPred = Prediction.builder().id(50L).user(user).edition(edition).name("Porra").build();
        when(predictionRepository.findByUserGoogleEmailAndEditionLeagueId("player@test.com", 10L)).thenReturn(Optional.of(userPred));
        when(matchRepository.findById(103L)).thenReturn(Optional.of(finishedMatch));

        MatchPredictionItemDTO item = MatchPredictionItemDTO.builder()
                .matchId(103L)
                .homeScore(2)
                .awayScore(1)
                .build();

        IllegalStateException ex = assertThrows(IllegalStateException.class, () ->
                matchPredictionService.saveMatchdayPredictions("player@test.com", 10L, List.of(item)));

        assertTrue(ex.getMessage().contains("ya ha finalizado"));
        verify(matchPredictionRepository, never()).save(any(MatchPrediction.class));
    }

    @Test
    @DisplayName("saveMatchdayPredictions rechaza si el usuario no es miembro de la liga privada")
    void saveMatchdayPredictions_ThrowsSecurityExceptionWhenNotMember() {
        when(userAccountRepository.findByGoogleEmail("player@test.com")).thenReturn(Optional.of(user));
        when(editionRepository.findByLeagueIdAndStatus(10L, "ACTIVE")).thenReturn(Optional.of(edition));
        when(membershipRepository.existsById(any(Membership.MembershipId.class))).thenReturn(false);

        MatchPredictionItemDTO item = MatchPredictionItemDTO.builder().matchId(101L).homeScore(2).awayScore(1).build();

        SecurityException ex = assertThrows(SecurityException.class, () ->
                matchPredictionService.saveMatchdayPredictions("player@test.com", 10L, List.of(item)));

        assertTrue(ex.getMessage().contains("No perteneces a esta liga privada"));
        verify(matchPredictionRepository, never()).save(any(MatchPrediction.class));
    }

    @Test
    @DisplayName("evaluatePredictionsForMatch actualiza puntos correctamente con MatchScoringCalculator")
    void evaluatePredictionsForMatch_CalculatesAndSavesPoints() {
        MatchPrediction mp = MatchPrediction.builder()
                .id(1L)
                .match(finishedMatch)
                .prediction(Prediction.builder().id(50L).edition(edition).build())
                .homeScore(2)
                .awayScore(1)
                .build();

        when(matchPredictionRepository.findByMatchId(103L)).thenReturn(List.of(mp));
        when(matchScoringCalculator.calculate(eq(2), eq(1), eq(2), eq(1), any(ScoringRuleSet.class)))
                .thenReturn(new MatchScoreResult(3, true, true, true, "Resultado exacto 2-1 (3 pts)"));

        matchPredictionService.evaluatePredictionsForMatch(finishedMatch);

        assertEquals(3, mp.getPointsAwarded());
        assertTrue(mp.getIsExactScore());
        assertTrue(mp.getIsCorrectSign());
        assertEquals("Resultado exacto 2-1 (3 pts)", mp.getScoringDetails());
        verify(matchPredictionRepository).save(mp);
    }
}
