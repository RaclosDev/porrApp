package com.porra.mundial.service;

import com.porra.mundial.dto.MatchdayPointsDTO;
import com.porra.mundial.dto.ParticipantScoreDTO;
import com.porra.mundial.dto.PredictionDataDTO;
import com.porra.mundial.model.Competition;
import com.porra.mundial.model.Edition;
import com.porra.mundial.model.Match;
import com.porra.mundial.model.MatchPrediction;
import com.porra.mundial.model.MatchStatusNormalized;
import com.porra.mundial.model.Membership;
import com.porra.mundial.model.Prediction;
import com.porra.mundial.model.UserAccount;
import com.porra.mundial.repository.EditionRepository;
import com.porra.mundial.repository.MatchPredictionRepository;
import com.porra.mundial.repository.MembershipRepository;
import com.porra.mundial.repository.MatchRepository;
import com.porra.mundial.repository.PredictionRepository;
import com.porra.mundial.scoring.ScoringRuleSet;
import com.porra.mundial.scoring.WorldCup2026ScoringStrategy;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class LeaderboardServiceTest {

    @Mock
    private PredictionRepository predictionRepository;

    @Mock
    private OfficialResultsService officialResultsService;

    @Mock
    private TopScorerService topScorerService;

    @Mock
    private MatchRepository matchRepository;

    @Mock
    private MatchPredictionRepository matchPredictionRepository;

    @Mock
    private MembershipRepository membershipRepository;

    @Mock
    private EditionRepository editionRepository;

    @Spy
    private WorldCup2026ScoringStrategy scoringStrategy = new WorldCup2026ScoringStrategy();

    @InjectMocks
    private LeaderboardService leaderboardService;

    @Test
    void pichichiFlagAppliesToBothLeaderboardAndIndividualScore() {
        Edition enabled = Edition.builder().pichichi(true).build();
        Edition disabled = Edition.builder().pichichi(false).build();
        Prediction on = championPrediction(701L, enabled);
        Prediction off = championPrediction(702L, disabled);
        on.getBracketData().setScorer("Kylian Mbappé");
        off.getBracketData().setScorer("Kylian Mbappé");
        PredictionDataDTO official = new PredictionDataDTO();
        official.setScorer("Kylian Mbappé");
        when(officialResultsService.current()).thenReturn(new OfficialResultsService.OfficialResults(
                official, Collections.emptyMap(), Collections.emptyMap(), List.of(),
                List.of(), List.of(), List.of(), List.of("España", "Brasil"), "España"));
        when(predictionRepository.findAllWithUserAndEdition()).thenReturn(List.of(on, off));
        when(predictionRepository.findById(702L)).thenReturn(Optional.of(off));

        var scores = leaderboardService.getLeaderboard(null);

        assertEquals(200, scores.stream().filter(s -> s.getId().equals(701L)).findFirst().orElseThrow().getScorer());
        assertEquals(0, scores.stream().filter(s -> s.getId().equals(702L)).findFirst().orElseThrow().getScorer());
        assertEquals(0, leaderboardService.calculateScoreForPrediction(702L).getScorer());
    }

    @Test
    void ignoresLegacyBracketPointsInMatchDayEditionButKeepsMatchPoints() {
        Edition edition = Edition.builder().poolFormat(com.porra.mundial.model.PoolFormat.MATCH_DAY)
                .competition(Competition.builder().externalId("esp.1").build()).build();
        Prediction prediction = championPrediction(123L, edition);
        when(predictionRepository.findById(123L)).thenReturn(Optional.of(prediction));
        when(matchPredictionRepository.findByPredictionId(123L)).thenReturn(List.of(
                MatchPrediction.builder().pointsAwarded(3).build()));
        officialChampion("España");
        ParticipantScoreDTO score = leaderboardService.calculateScoreForPrediction(123L);
        assertEquals(0, score.getFinals());
        assertEquals(3, score.getTotal());
    }

    @Test
    @DisplayName("getLeaderboard calcula y asigna matchPoints correctamente a partir de MatchPredictions")
    void getLeaderboard_CalculatesAndSetsMatchPoints() {
        UserAccount user = UserAccount.builder().id(10L).participantName("Jugador 1").build();
        Prediction pred = Prediction.builder()
                .id(100L)
                .user(user)
                .name("Porra 1")
                .paymentStatus("PAID")
                .scoreCalculatedAt(null)
                .build();

        MatchPrediction mp1 = MatchPrediction.builder().id(1L).prediction(pred).pointsAwarded(3).scoringDetails("Exacto 2-1").build();
        MatchPrediction mp2 = MatchPrediction.builder().id(2L).prediction(pred).pointsAwarded(1).scoringDetails("Signo 1").build();

        when(predictionRepository.findByEditionLeagueIdWithUserAndEdition(10L)).thenReturn(List.of(pred));
        when(matchPredictionRepository.findWithMatchByPredictionIdIn(List.of(100L))).thenReturn(List.of(mp1, mp2));
        when(officialResultsService.current()).thenReturn(new OfficialResultsService.OfficialResults(
                new PredictionDataDTO(), Collections.emptyMap(), Collections.emptyMap(), List.of(),
                List.of(), List.of(), List.of(), List.of(), null));

        List<ParticipantScoreDTO> leaderboard = leaderboardService.getLeaderboard(10L);

        assertFalse(leaderboard.isEmpty());
        ParticipantScoreDTO first = leaderboard.get(0);
        assertEquals(4, first.getMatchPoints(), "matchPoints debe ser la suma de los puntos otorgados (3 + 1)");
        assertEquals(4, first.getTotal(), "total debe incluir los matchPoints (4)");
        assertEquals(4, pred.getMatchPoints(), "La entidad Prediction debe recibir el valor calculado de matchPoints");
        assertEquals(4, pred.getTotalPoints(), "La entidad Prediction debe recibir el valor calculado de totalPoints");
        // Una sola consulta para todos los participantes, no una por participante.
        org.mockito.Mockito.verify(matchPredictionRepository, org.mockito.Mockito.times(1)).findWithMatchByPredictionIdIn(org.mockito.ArgumentMatchers.any());
        org.mockito.Mockito.verify(matchPredictionRepository, org.mockito.Mockito.never()).findByPredictionId(org.mockito.ArgumentMatchers.anyLong());
    }

    @Test
    @DisplayName("getLeaderboard utiliza resultados materializados cuando scoreCalculatedAt no es null")
    void getLeaderboard_UsesFastMaterializedWhenCalculatedAtPresent() {
        UserAccount user = UserAccount.builder().id(10L).participantName("Jugador 1").build();
        Prediction pred = Prediction.builder()
                .id(100L)
                .user(user)
                .name("Porra 1")
                .paymentStatus("PAID")
                .matchPoints(6)
                .totalPoints(6)
                .scoreCalculatedAt(LocalDateTime.now())
                .build();

        when(predictionRepository.findByEditionLeagueIdWithUserAndEdition(10L)).thenReturn(List.of(pred));

        List<ParticipantScoreDTO> leaderboard = leaderboardService.getLeaderboard(10L);

        assertEquals(1, leaderboard.size());
        assertEquals(6, leaderboard.get(0).getMatchPoints());
        assertEquals(6, leaderboard.get(0).getTotal());
        verifyNoInteractions(matchPredictionRepository);
    }

    @Test
    @DisplayName("getLeaderboard incluye miembros de la liga aunque todavía no tengan una porra")
    void getLeaderboard_IncludesMembersWithoutPredictions() {
        UserAccount existingUser = UserAccount.builder().id(10L).participantName("Jugador 1").build();
        Prediction pred = Prediction.builder()
                .id(100L)
                .user(existingUser)
                .name("Porra 1")
                .paymentStatus("PAID")
                .matchPoints(6)
                .totalPoints(6)
                .scoreCalculatedAt(LocalDateTime.now())
                .build();
        UserAccount joinedUser = UserAccount.builder().id(20L).participantName("Jugador Unido").build();
        Membership membership = Membership.builder().user(joinedUser).build();

        when(predictionRepository.findByEditionLeagueIdWithUserAndEdition(10L)).thenReturn(List.of(pred));
        when(membershipRepository.findByLeagueId(10L)).thenReturn(List.of(membership));

        List<ParticipantScoreDTO> leaderboard = leaderboardService.getLeaderboard(10L);

        assertEquals(2, leaderboard.size());
        ParticipantScoreDTO joinedScore = leaderboard.stream()
                .filter(score -> Long.valueOf(20L).equals(score.getUserId()))
                .findFirst()
                .orElseThrow();
        assertEquals("Jugador Unido", joinedScore.getName());
        assertEquals(0, joinedScore.getTotal());
        assertEquals(0, joinedScore.getMatchPoints());
        assertEquals(null, joinedScore.getId());
        assertFalse(joinedScore.isPending());
    }

    @Test
    @DisplayName("getLeaderboard prioriza el estado de pago de la membresía sobre el de la predicción")
    void getLeaderboard_PrefersMembershipPaymentStatus() {
        UserAccount unpaidUser = UserAccount.builder().id(10L).participantName("Sin Pagar").build();
        Prediction paidPrediction = Prediction.builder()
                .id(100L)
                .user(unpaidUser)
                .name("Porra 1")
                .paymentStatus("PAID")
                .scoreCalculatedAt(LocalDateTime.now())
                .build();
        UserAccount paidUser = UserAccount.builder().id(20L).participantName("Pagado").build();
        Prediction unpaidPrediction = Prediction.builder()
                .id(200L)
                .user(paidUser)
                .name("Porra 2")
                .paymentStatus("PENDING")
                .scoreCalculatedAt(LocalDateTime.now())
                .build();

        when(predictionRepository.findByEditionLeagueIdWithUserAndEdition(10L))
                .thenReturn(List.of(paidPrediction, unpaidPrediction));
        when(membershipRepository.findByLeagueId(10L)).thenReturn(List.of(
                Membership.builder().user(unpaidUser).paymentStatus("PENDING").build(),
                Membership.builder().user(paidUser).paymentStatus("PAID").build()));

        List<ParticipantScoreDTO> leaderboard = leaderboardService.getLeaderboard(10L);

        assertTrue(leaderboard.stream()
                .filter(score -> Long.valueOf(10L).equals(score.getUserId()))
                .findFirst().orElseThrow().isPending());
        assertFalse(leaderboard.stream()
                .filter(score -> Long.valueOf(20L).equals(score.getUserId()))
                .findFirst().orElseThrow().isPending());
    }

    @Test
    @DisplayName("getMatchdayBreakdown agrupa los puntos por jornada y marca la jornada actual")
    void getMatchdayBreakdown_GroupsPointsByRoundAndMarksCurrentMatchday() {
        UserAccount user = UserAccount.builder().id(10L).participantName("Jugador 1").build();
        Prediction pred = Prediction.builder()
                .id(100L)
                .user(user)
                .name("Porra 1")
                .paymentStatus("PAID")
                .build();

        Match jornada1 = Match.builder()
                .round("Jornada 1")
                .matchDate(LocalDateTime.of(2026, 8, 15, 17, 30))
                .finished(true)
                .status(MatchStatusNormalized.FINISHED)
                .build();
        Match jornada2 = Match.builder()
                .round("Jornada 2")
                .matchDate(LocalDateTime.of(2026, 8, 22, 17, 30))
                .finished(true)
                .status(MatchStatusNormalized.FINISHED)
                .build();
        Match jornada3 = Match.builder()
                .round("Jornada 3")
                .matchDate(LocalDateTime.of(2026, 8, 29, 17, 30))
                .finished(false)
                .status(MatchStatusNormalized.SCHEDULED)
                .build();

        MatchPrediction jornada1Exact = MatchPrediction.builder()
                .id(1L).prediction(pred).match(jornada1).pointsAwarded(3).build();
        MatchPrediction jornada2Sign = MatchPrediction.builder()
                .id(2L).prediction(pred).match(jornada2).pointsAwarded(1).build();
        MatchPrediction jornada2Exact = MatchPrediction.builder()
                .id(3L).prediction(pred).match(jornada2).pointsAwarded(2).build();
        MatchPrediction jornada3Sign = MatchPrediction.builder()
                .id(4L).prediction(pred).match(jornada3).pointsAwarded(4).build();

        when(predictionRepository.findByEditionLeagueIdWithUserAndEdition(10L)).thenReturn(List.of(pred));
        when(editionRepository.findByLeagueIdAndStatus(10L, "ACTIVE"))
                .thenReturn(Optional.of(Edition.builder()
                        .competition(Competition.builder().id(4L).build())
                        .build()));
        when(matchRepository.findByCompetitionId(4L))
                .thenReturn(List.of(jornada3, jornada1, jornada2));
        when(matchPredictionRepository.findByPredictionEditionLeagueId(10L))
                .thenReturn(List.of(jornada1Exact, jornada2Sign, jornada2Exact, jornada3Sign));

        List<MatchdayPointsDTO> breakdown = leaderboardService.getMatchdayBreakdown(10L);

        assertEquals(3, breakdown.size());
        assertEquals("Jornada 1", breakdown.get(0).getLabel());
        assertEquals(3, breakdown.get(0).getPointsByPrediction().get(100L));
        assertTrue(breakdown.get(0).isFinished());
        assertFalse(breakdown.get(0).isCurrent());

        assertEquals("Jornada 2", breakdown.get(1).getLabel());
        assertEquals(3, breakdown.get(1).getPointsByPrediction().get(100L));
        assertTrue(breakdown.get(1).isFinished());

        assertEquals("Jornada 3", breakdown.get(2).getLabel());
        assertEquals(4, breakdown.get(2).getPointsByPrediction().get(100L));
        assertFalse(breakdown.get(2).isFinished());
        assertTrue(breakdown.get(2).isCurrent());
    }

    /** Cuadro que solo acierta el campeón, para comparar lo que da con cada reglamento. */
    private static Prediction championPrediction(long id, Edition edition) {
        if (edition.getCompetition() == null) edition.setCompetition(Competition.builder().externalId(Competition.WORLD_CUP_EXTERNAL_ID).build());
        if (edition.getPoolFormat() == null) edition.setPoolFormat(com.porra.mundial.model.PoolFormat.FULL_BRACKET);
        PredictionDataDTO bracket = new PredictionDataDTO();
        bracket.setChampion("España");
        return Prediction.builder()
                .id(id)
                .user(UserAccount.builder().id(id).participantName("Jugador " + id).build())
                .edition(edition)
                .name("Porra " + id)
                .paymentStatus("PAID")
                .bracketData(bracket)
                .build();
    }

    private void officialChampion(String champion) {
        when(officialResultsService.current()).thenReturn(new OfficialResultsService.OfficialResults(
                new PredictionDataDTO(), Collections.emptyMap(), Collections.emptyMap(), List.of(),
                List.of(), List.of(), List.of(), List.of(champion, "Brasil"), champion));
    }

    @Test
    @DisplayName("Cada porra puntúa con las reglas de su edición, y sin reglas guardadas con las de por defecto")
    void getLeaderboard_ScoresEachEditionWithItsOwnRules() {
        Edition defaults = Edition.builder().id(1L).pichichi(false).build();
        Edition storedDefaults = Edition.builder().id(2L).pichichi(false)
                .scoringRulesJson(ScoringRuleSet.defaultWorldCup2026().toJson()).build();
        Edition custom = Edition.builder().id(3L).pichichi(false)
                .scoringRulesJson(ScoringRuleSet.builder().championPoints(500).build().toJson()).build();
        Prediction withDefaults = championPrediction(100L, defaults);
        Prediction withStoredDefaults = championPrediction(200L, storedDefaults);
        Prediction withCustom = championPrediction(300L, custom);
        when(predictionRepository.findAllWithUserAndEdition())
                .thenReturn(List.of(withDefaults, withStoredDefaults, withCustom));
        officialChampion("España");

        List<ParticipantScoreDTO> leaderboard = leaderboardService.getLeaderboard(null);

        assertEquals(List.of(300L, 100L, 200L), leaderboard.stream().map(ParticipantScoreDTO::getId).toList());
        assertEquals(500, leaderboard.get(0).getFinals());
        assertEquals(200, leaderboard.get(1).getFinals());
        assertEquals(200, leaderboard.get(2).getFinals());
        assertEquals(500, withCustom.getTotalPoints(), "se guarda la puntuación con las reglas de la liga");
        assertEquals(200, withDefaults.getTotalPoints());
    }

    @Test
    @DisplayName("La puntuación de una sola porra también usa las reglas de su edición")
    void calculateScoreForPrediction_UsesTheEditionRules() {
        Edition custom = Edition.builder().id(3L).pichichi(false)
                .scoringRulesJson(ScoringRuleSet.builder().championPoints(350).build().toJson()).build();
        when(predictionRepository.findById(300L)).thenReturn(Optional.of(championPrediction(300L, custom)));
        when(matchPredictionRepository.findByPredictionId(300L)).thenReturn(List.of());
        officialChampion("España");

        ParticipantScoreDTO score = leaderboardService.calculateScoreForPrediction(300L);

        assertEquals(350, score.getFinals());
        assertEquals(350, score.getTotal());
    }

}
