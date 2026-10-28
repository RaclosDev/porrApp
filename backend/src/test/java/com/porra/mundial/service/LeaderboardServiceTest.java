package com.porra.mundial.service;

import com.porra.mundial.dto.ParticipantScoreDTO;
import com.porra.mundial.model.MatchPrediction;
import com.porra.mundial.model.Membership;
import com.porra.mundial.model.Prediction;
import com.porra.mundial.model.UserAccount;
import com.porra.mundial.repository.MatchPredictionRepository;
import com.porra.mundial.repository.MembershipRepository;
import com.porra.mundial.repository.MatchRepository;
import com.porra.mundial.repository.PredictionRepository;
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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class LeaderboardServiceTest {

    @Mock
    private PredictionRepository predictionRepository;

    @Mock
    private StandingsService standingsService;

    @Mock
    private TopScorerService topScorerService;

    @Mock
    private MatchRepository matchRepository;

    @Mock
    private SyncService syncService;

    @Mock
    private MatchPredictionRepository matchPredictionRepository;

    @Mock
    private MembershipRepository membershipRepository;

    @Spy
    private WorldCup2026ScoringStrategy scoringStrategy = new WorldCup2026ScoringStrategy();

    @InjectMocks
    private LeaderboardService leaderboardService;

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

        MatchPrediction mp1 = MatchPrediction.builder().id(1L).pointsAwarded(3).scoringDetails("Exacto 2-1").build();
        MatchPrediction mp2 = MatchPrediction.builder().id(2L).pointsAwarded(1).scoringDetails("Signo 1").build();

        when(predictionRepository.findByEditionLeagueIdWithUserAndEdition(10L)).thenReturn(List.of(pred));
        when(matchPredictionRepository.findByPredictionId(100L)).thenReturn(List.of(mp1, mp2));
        when(standingsService.getAllStandings()).thenReturn(Collections.emptyList());
        when(matchRepository.findAll()).thenReturn(Collections.emptyList());

        List<ParticipantScoreDTO> leaderboard = leaderboardService.getLeaderboard(10L);

        assertFalse(leaderboard.isEmpty());
        ParticipantScoreDTO first = leaderboard.get(0);
        assertEquals(4, first.getMatchPoints(), "matchPoints debe ser la suma de los puntos otorgados (3 + 1)");
        assertEquals(4, first.getTotal(), "total debe incluir los matchPoints (4)");
        assertEquals(4, pred.getMatchPoints(), "La entidad Prediction debe recibir el valor calculado de matchPoints");
        assertEquals(4, pred.getTotalPoints(), "La entidad Prediction debe recibir el valor calculado de totalPoints");
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

}
