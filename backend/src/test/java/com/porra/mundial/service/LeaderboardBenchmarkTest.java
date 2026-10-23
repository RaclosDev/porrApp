package com.porra.mundial.service;

import com.porra.mundial.dto.PredictionDataDTO;
import com.porra.mundial.dto.ParticipantScoreDTO;
import com.porra.mundial.model.Prediction;
import com.porra.mundial.model.UserAccount;
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
        officialData.setSf(List.of(List.of("España", "Argentina")));
        officialData.setFinalMatch(List.of("España", "Inglaterra"));
        when(predictionPersistenceService.rebuildPredictionDataDtoFromTables(1L)).thenReturn(officialData);

        List<Prediction> simulated1000 = new ArrayList<>(1000);
        for (long i = 2; i <= 1001; i++) {
            simulated1000.add(Prediction.builder()
                    .id(i)
                    .name("Porra " + i)
                    .user(UserAccount.builder().id(i).participantName("User_" + i).build())
                    .paymentStatus("PAID")
                    .build());
        }
        when(predictionRepository.findByEditionLeagueId(10L)).thenReturn(simulated1000);

        PredictionDataDTO participantData = new PredictionDataDTO();
        participantData.setChampion("España");
        participantData.setScorer("Kylian Mbappé");
        participantData.setGroups(Map.of("A", List.of("México", "Sudáfrica", "Corea del Sur", "Chequia")));
        participantData.setR16(List.of(List.of("España", "Francia"), List.of("Brasil", "Alemania")));
        participantData.setQf(List.of(List.of("España", "Brasil")));
        participantData.setSf(List.of(List.of("España", "Argentina")));
        participantData.setFinalMatch(List.of("España", "Inglaterra"));
        when(predictionPersistenceService.rebuildPredictionDataDtoFromTables(anyLong())).thenAnswer(inv -> {
            Long id = inv.getArgument(0);
            return id.equals(1L) ? officialData : participantData;
        });

        when(standingsService.getOfficialPoints()).thenReturn(Collections.emptyMap());
        when(standingsService.getAllStandings()).thenReturn(Collections.emptyList());
        when(topScorerService.getTopScorers()).thenReturn(List.of(Map.of("name", "Kylian Mbappé", "goals", 6)));
        when(matchRepository.findAll()).thenReturn(Collections.emptyList());

        long start = System.currentTimeMillis();
        List<ParticipantScoreDTO> result = leaderboardService.getLeaderboard(10L);
        long elapsed = System.currentTimeMillis() - start;

        assertEquals(1000, result.size());
        assertTrue(elapsed < 2000, "El calculo de 1000 participantes debe completarse en menos de 2000ms. Tomo: " + elapsed + "ms");
    }
}
