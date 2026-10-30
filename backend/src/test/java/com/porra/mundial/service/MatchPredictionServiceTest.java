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
import static org.mockito.ArgumentMatchers.eq;
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
                .competition(Competition.builder().id(2L).build())
                .status("ACTIVE")
                .poolFormat(PoolFormat.MATCH_DAY)
                .scoringRulesJson(ScoringRuleSet.defaultWorldCup2026().toJson())
                .build();

        Team home = Team.builder().id(1L).name("España").build();
        Team away = Team.builder().id(2L).name("Alemania").build();

        futureMatch = Match.builder()
                .id(101L)
                .competition(edition.getCompetition())
                .homeTeam(home)
                .awayTeam(away)
                .matchDate(LocalDateTime.now().plusDays(2))
                .finished(false)
                .round("Jornada 1")
                .build();

        pastMatch = Match.builder()
                .id(102L)
                .competition(edition.getCompetition())
                .homeTeam(home)
                .awayTeam(away)
                .matchDate(LocalDateTime.now().minusHours(1))
                .finished(false)
                .round("Jornada 1")
                .build();

        finishedMatch = Match.builder()
                .id(103L)
                .competition(edition.getCompetition())
                .homeTeam(home)
                .awayTeam(away)
                .matchDate(LocalDateTime.now().minusDays(1))
                .finished(true)
                .homeScore(2)
                .awayScore(1)
                .round("Jornada 1")
                .build();
    
        lenient().when(userAccountRepository.findByGoogleEmail("player@test.com")).thenReturn(Optional.of(user));
        lenient().when(membershipRepository.existsById(any(Membership.MembershipId.class))).thenReturn(true);
    }

    @Test
    @DisplayName("getMatchdayFixtures marca como bloqueados los partidos pasados o finalizados y abiertos los futuros")
    void getMatchdayFixtures_MarksLockStatusesCorrectly() {
        when(editionRepository.findByLeagueIdAndStatus(10L, "ACTIVE")).thenReturn(Optional.of(edition));
        when(matchRepository.findByCompetitionIdOrderByMatchDateAsc(2L)).thenReturn(List.of(futureMatch, pastMatch, finishedMatch));
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

    @Test
    @DisplayName("Si se corrige el marcador final, los puntos del pronóstico se recalculan")
    void evaluatePredictionsForMatch_ReplacesPointsAfterACorrection() {
        Prediction prediction = Prediction.builder().id(50L).edition(edition).scoreCalculatedAt(LocalDateTime.now()).build();
        MatchPrediction mp = MatchPrediction.builder().id(1L).match(finishedMatch).prediction(prediction)
                .homeScore(2).awayScore(1).build();
        when(matchPredictionRepository.findByMatchId(103L)).thenReturn(List.of(mp));
        when(matchScoringCalculator.calculate(eq(2), eq(1), eq(2), eq(1), any(ScoringRuleSet.class)))
                .thenReturn(new MatchScoreResult(3, true, true, true, "Resultado exacto 2-1 (3 pts)"));
        when(matchScoringCalculator.calculate(eq(2), eq(1), eq(2), eq(2), any(ScoringRuleSet.class)))
                .thenReturn(new MatchScoreResult(0, false, false, false, "Fallo (0 pts)"));
        matchPredictionService.evaluatePredictionsForMatch(finishedMatch);
        prediction.setScoreCalculatedAt(LocalDateTime.now());

        finishedMatch.setAwayScore(2);
        matchPredictionService.evaluatePredictionsForMatch(finishedMatch);

        assertEquals(0, mp.getPointsAwarded());
        assertFalse(mp.getIsExactScore());
        assertNull(prediction.getScoreCalculatedAt(), "la porra tiene que recalcular su total");
    }

    @Test
    void hasUnscoredPredictionsAsksForPredictionsWithoutPoints() {
        when(matchPredictionRepository.existsByMatchIdAndPointsAwardedIsNull(103L)).thenReturn(true);

        assertTrue(matchPredictionService.hasUnscoredPredictions(103L));
        assertFalse(matchPredictionService.hasUnscoredPredictions(null));
    }

    @Test
    @DisplayName("getMatchdayFixtures filtra correctamente por 'Grupo A' cuando el partido tiene groupName 'A'")
    void getMatchdayFixtures_FiltersByRoundGroup() {
        when(editionRepository.findByLeagueIdAndStatus(10L, "ACTIVE")).thenReturn(Optional.of(edition));
        Match groupAMatch = Match.builder().id(201L).groupName("A").finished(false).matchDate(LocalDateTime.now().plusDays(1)).build();
        Match groupBMatch = Match.builder().id(202L).groupName("B").finished(false).matchDate(LocalDateTime.now().plusDays(1)).build();
        when(matchRepository.findRoundCandidates(eq(2L), eq(List.of("grupo a", "a")), any(), any(), eq(false)))
                .thenReturn(List.of(groupAMatch, groupBMatch));
        when(predictionRepository.findByUserGoogleEmailAndEditionLeagueId("player@test.com", 10L)).thenReturn(Optional.empty());

        List<MatchdayFixturePredictionDTO> fixtures = matchPredictionService.getMatchdayFixtures("player@test.com", 10L, "Grupo A");

        assertEquals(1, fixtures.size());
        assertEquals(201L, fixtures.get(0).getMatchId());
        verify(matchRepository, never()).findByCompetitionIdOrderByMatchDateAsc(any());
    }

    @Test
    void rejectsMatchesFromAnotherCompetition() {
        when(editionRepository.findByLeagueIdAndStatus(10L, "ACTIVE")).thenReturn(Optional.of(edition));
        when(predictionRepository.findByUserGoogleEmailAndEditionLeagueId("player@test.com", 10L))
                .thenReturn(Optional.of(Prediction.builder().id(50L).edition(edition).build()));
        futureMatch.setCompetition(Competition.builder().id(999L).build());
        when(matchRepository.findById(101L)).thenReturn(Optional.of(futureMatch));

        var item = MatchPredictionItemDTO.builder().matchId(101L).homeScore(2).awayScore(1).build();
        var error = assertThrows(IllegalArgumentException.class, () ->
                matchPredictionService.saveMatchdayPredictions("player@test.com", 10L, List.of(item)));
        assertTrue(error.getMessage().contains("no pertenece"));
        verify(matchPredictionRepository, never()).save(any());
    }

    @Test
    void groupsUnknownRoundsByDateAndAllowsFilteringThatDate() {
        futureMatch.setRound("group");
        when(editionRepository.findByLeagueIdAndStatus(10L, "ACTIVE")).thenReturn(Optional.of(edition));
        String dateRound = "Fecha " + futureMatch.getMatchDate().toLocalDate();
        LocalDateTime day = futureMatch.getMatchDate().toLocalDate().atStartOfDay();
        when(matchRepository.findRoundCandidates(2L, List.of(dateRound.toLowerCase()), day, day.plusDays(1), false))
                .thenReturn(List.of(futureMatch, pastMatch));

        var fixtures = matchPredictionService.getMatchdayFixtures("player@test.com", 10L, dateRound);
        assertEquals(1, fixtures.size());
        assertEquals(dateRound, fixtures.getFirst().getRound());
    }

    @Test
    void cancelledAndLiveMatchesCannotBeEditedEvenWithFutureKickoff() {
        futureMatch.setStatus(MatchStatusNormalized.CANCELLED);
        pastMatch.setMatchDate(LocalDateTime.now().plusHours(1));
        pastMatch.setStatus(MatchStatusNormalized.LIVE);
        when(editionRepository.findByLeagueIdAndStatus(10L, "ACTIVE")).thenReturn(Optional.of(edition));
        when(matchRepository.findByCompetitionIdOrderByMatchDateAsc(2L)).thenReturn(List.of(futureMatch, pastMatch));
        assertTrue(matchPredictionService.getMatchdayFixtures("player@test.com", 10L, null).stream()
                .allMatch(MatchdayFixturePredictionDTO::isLocked));
    }

    @Test
    void doesNotAwardPointsForScheduledZeroZeroAndDerivesSignFromScore() {
        when(editionRepository.findByLeagueIdAndStatus(10L, "ACTIVE")).thenReturn(Optional.of(edition));
        when(predictionRepository.findByUserGoogleEmailAndEditionLeagueId("player@test.com", 10L))
                .thenReturn(Optional.of(Prediction.builder().id(50L).edition(edition).build()));
        futureMatch.setHomeScore(0);
        futureMatch.setAwayScore(0);
        when(matchRepository.findById(101L)).thenReturn(Optional.of(futureMatch));
        var item = MatchPredictionItemDTO.builder().matchId(101L).homeScore(0).awayScore(0).sign("1").build();
        matchPredictionService.saveMatchdayPredictions("player@test.com", 10L, List.of(item));

        var saved = org.mockito.ArgumentCaptor.forClass(MatchPrediction.class);
        verify(matchPredictionRepository).save(saved.capture());
        assertEquals("X", saved.getValue().getPredictionSign());
        assertNull(saved.getValue().getPointsAwarded());
        verifyNoInteractions(matchScoringCalculator);
    }

    @Test
    void evaluatesSignOnlyPredictionsWhenMatchFinishes() {
        var prediction = MatchPrediction.builder().match(finishedMatch).predictionSign("1")
                .prediction(Prediction.builder().edition(edition).build()).build();
        when(matchPredictionRepository.findByMatchId(103L)).thenReturn(List.of(prediction));
        when(matchScoringCalculator.calculateSign(eq("1"), eq(2), eq(1), any()))
                .thenReturn(new MatchScoreResult(1, false, true, false, "Signo correcto"));
        matchPredictionService.evaluatePredictionsForMatch(finishedMatch);
        assertEquals(1, prediction.getPointsAwarded());
        assertFalse(prediction.getIsExactScore());
    }

    @Test
    @DisplayName("rescoreEdition vuelve a puntuar los partidos terminados con las reglas nuevas de la edición")
    void rescoreEdition_AppliesTheNewRulesToFinishedMatches() {
        // Calculador real: lo que se comprueba son los puntos que salen de las reglas de la liga.
        MatchPredictionService service = new MatchPredictionService(matchRepository, matchPredictionRepository,
                predictionRepository, userAccountRepository, editionRepository, membershipRepository,
                new MatchScoringCalculator());
        edition.setScoringRulesJson(ScoringRuleSet.builder()
                .exactScorePoints(10).correctSignPoints(2).goalDiffBonusPoints(0).build().toJson());
        Prediction prediction = Prediction.builder().id(50L).edition(edition).build();
        MatchPrediction exact = MatchPrediction.builder().id(1L).prediction(prediction).match(finishedMatch)
                .homeScore(2).awayScore(1).pointsAwarded(5).build();
        MatchPrediction sameGoalDiff = MatchPrediction.builder().id(2L).prediction(prediction).match(finishedMatch)
                .homeScore(3).awayScore(2).pointsAwarded(4).build();
        MatchPrediction signOnly = MatchPrediction.builder().id(3L).prediction(prediction).match(finishedMatch)
                .predictionSign("1").pointsAwarded(3).build();
        MatchPrediction notPlayed = MatchPrediction.builder().id(4L).prediction(prediction).match(futureMatch)
                .homeScore(1).awayScore(0).build();
        when(matchPredictionRepository.findWithMatchByPredictionEditionId(100L))
                .thenReturn(List.of(exact, sameGoalDiff, signOnly, notPlayed));

        int rescored = service.rescoreEdition(edition);

        assertEquals(3, rescored);
        assertEquals(10, exact.getPointsAwarded());
        assertTrue(exact.getIsExactScore());
        assertEquals(2, sameGoalDiff.getPointsAwarded(), "sin bonus por diferencia de goles en esta liga");
        assertEquals(2, signOnly.getPointsAwarded());
        assertNull(notPlayed.getPointsAwarded(), "un partido por jugar sigue sin puntos");
        verify(matchPredictionRepository).saveAll(List.of(exact, sameGoalDiff, signOnly));
    }

    @Test
    void rescoreEditionIgnoresAnUnsavedEdition() {
        assertEquals(0, matchPredictionService.rescoreEdition(null));
        assertEquals(0, matchPredictionService.rescoreEdition(Edition.builder().build()));
        verifyNoInteractions(matchPredictionRepository);
    }

    @Test
    @DisplayName("getMatchdayFixtures retorna lista vacía cuando el grupo es la Porra Global o no es modalidad MATCH_DAY")
    void getMatchdayFixtures_ReturnsEmptyList_WhenNotMatchDay() {
        List<MatchdayFixturePredictionDTO> globalFixtures = matchPredictionService.getMatchdayFixtures("player@test.com", 1L, null);
        assertTrue(globalFixtures.isEmpty(), "La Porra Global no debe devolver partidos de jornada");

        Edition bracketEdition = Edition.builder()
                .id(101L)
                .league(league)
                .status("ACTIVE")
                .poolFormat(PoolFormat.FULL_BRACKET)
                .build();
        when(editionRepository.findByLeagueIdAndStatus(10L, "ACTIVE")).thenReturn(Optional.of(bracketEdition));
        List<MatchdayFixturePredictionDTO> bracketFixtures = matchPredictionService.getMatchdayFixtures("player@test.com", 10L, null);
        assertTrue(bracketFixtures.isEmpty(), "Un torneo FULL_BRACKET no debe devolver partidos de jornada");

        when(editionRepository.findByLeagueIdAndStatus(10L, "ACTIVE")).thenReturn(Optional.empty());
        List<MatchdayFixturePredictionDTO> noEditionFixtures = matchPredictionService.getMatchdayFixtures("player@test.com", 10L, null);
        assertTrue(noEditionFixtures.isEmpty(), "Una liga sin edición activa no debe devolver partidos de jornada");
    }
}
