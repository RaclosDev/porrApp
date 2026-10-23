package com.porra.mundial.service;

import com.porra.mundial.dto.PredictionDataDTO;
import com.porra.mundial.dto.ParticipantScoreDTO;
import com.porra.mundial.model.Prediction;
import com.porra.mundial.model.UserAccount;
import com.porra.mundial.repository.MatchPredictionRepository;
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

import java.util.*;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class LeaderboardBenchmarkTest {

    @Mock
    private PredictionRepository predictionRepository;

    @Mock
    private StandingsService standingsService;

    @Mock
    private TopScorerService topScorerService;

    @Mock
    private PredictionPersistenceService predictionPersistenceService;

    @Mock
    private MatchRepository matchRepository;

    @Mock
    private SyncService syncService;

    @Mock
    private MatchPredictionRepository matchPredictionRepository;

    @Spy
    private WorldCup2026ScoringStrategy scoringStrategy = new WorldCup2026ScoringStrategy();

    @InjectMocks
    private LeaderboardService leaderboardService;

    @Test
    @DisplayName("Benchmark: calcula el ranking de 1000 participantes en menos de 2 segundos")
    void benchmark1000ParticipantsScoring() {
        Prediction official = Prediction.builder()
                .id(1L)
                .name("official")
                .isOfficial(true)
                .build();
        when(predictionRepository.findByIsOfficialTrue()).thenReturn(Optional.of(official));

        PredictionDataDTO officialData = new PredictionDataDTO();
        officialData.setChampion("España");
        officialData.setScorer("Kylian Mbappé");
        officialData.setGroups(Map.of("A", List.of("México", "Sudáfrica", "Corea del Sur", "Chequia")));
        officialData.setR16(List.of(List.of("España", "Francia"), List.of("Brasil", "Alemania")));
        officialData.setQf(List.of(List.of("España", "Brasil")));
        officialData.setSf(List.of(List.of("España", "Alemania")));
        officialData.setFinalMatch(List.of("España", "Alemania"));

        when(predictionPersistenceService.rebuildPredictionDataDtoFromTables(1L)).thenReturn(officialData);
        when(standingsService.getOfficialPoints()).thenReturn(Collections.emptyMap());
        when(standingsService.getAllStandings()).thenReturn(Collections.emptyList());
        when(topScorerService.getTopScorers()).thenReturn(Collections.emptyList());
        when(matchRepository.findAll()).thenReturn(Collections.emptyList());

        int participantCount = 1000;
        List<Prediction> participants = new ArrayList<>(participantCount);
        for (int i = 2; i <= participantCount + 1; i++) {
            UserAccount user = UserAccount.builder()
                    .id((long) i)
                    .googleEmail("user" + i + "@example.com")
                    .participantName("Participante " + i)
                    .build();

            Prediction pred = Prediction.builder()
                    .id((long) i)
                    .user(user)
                    .name("Porra " + i)
                    .paymentStatus("PAID")
                    .build();
            participants.add(pred);

            PredictionDataDTO pData = new PredictionDataDTO();
            pData.setChampion(i % 2 == 0 ? "España" : "Brasil");
            pData.setScorer(i % 3 == 0 ? "Kylian Mbappé" : "Vinicius Jr");
            pData.setGroups(Map.of("A", List.of("México", "Corea del Sur", "Sudáfrica", "Chequia")));
            pData.setR16(List.of(List.of("España", "Francia"), List.of("Brasil", "Alemania")));
            pData.setQf(List.of(List.of("España", "Brasil")));
            pData.setSf(List.of(List.of("España", "Alemania")));
            pData.setFinalMatch(List.of("España", "Alemania"));

            when(predictionPersistenceService.rebuildPredictionDataDtoFromTables((long) i)).thenReturn(pData);
        }

        when(predictionRepository.findAll()).thenReturn(participants);
        when(matchPredictionRepository.findByPredictionId(anyLong())).thenReturn(Collections.emptyList());

        long startTime = System.currentTimeMillis();
        List<ParticipantScoreDTO> leaderboard = leaderboardService.getLeaderboard(null);
        long duration = System.currentTimeMillis() - startTime;

        System.out.printf("Benchmark completado: %d participantes calculados en %d ms%n", leaderboard.size(), duration);

        assertEquals(1000, leaderboard.size());
        assertTrue(duration < 2000, "El cálculo del ranking para 1000 participantes debe tardar menos de 2000ms. Tardó: " + duration + "ms");
        assertTrue(leaderboard.get(0).getTotal() >= leaderboard.get(leaderboard.size() - 1).getTotal(), "La clasificación debe estar ordenada descendentemente");
    }
}
