package com.porra.mundial.service.prediction;

import com.porra.mundial.model.Competition;
import com.porra.mundial.repository.CompetitionRepository;
import com.porra.mundial.repository.PredictionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.cache.concurrent.ConcurrentMapCacheManager;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ScoreInvalidationServiceTest {

    @Mock
    private PredictionRepository predictionRepository;

    @Mock
    private CompetitionRepository competitionRepository;

    @Mock
    private com.porra.mundial.repository.EditionRepository editionRepository;

    private final ConcurrentMapCacheManager cacheManager = new ConcurrentMapCacheManager();
    private ScoreInvalidationService service;

    @BeforeEach
    void setUp() {
        service = new ScoreInvalidationService(predictionRepository, competitionRepository, editionRepository,
                cacheManager);
        cacheManager.getCache(ScoreInvalidationService.LEADERBOARD_CACHE).put(7L, "clasificación vieja");
        cacheManager.getCache(ScoreInvalidationService.LEADERBOARD_CACHE).put(8L, "liga de otra competición");
    }

    @Test
    @DisplayName("Invalida las porras del Mundial y vacía solo las clasificaciones de sus ligas")
    void invalidatesWorldCupPredictionsAndEvictsTheLeaderboard() {
        when(competitionRepository.findIdByExternalId(Competition.WORLD_CUP_EXTERNAL_ID)).thenReturn(Optional.of(2L));
        when(predictionRepository.clearCalculatedScoresByCompetitionId(2L)).thenReturn(5);
        when(editionRepository.findLeagueIdsUsingCompetitions(java.util.List.of(2L))).thenReturn(java.util.List.of(7L));

        assertEquals(5, service.invalidateWorldCup());
        assertNull(cacheManager.getCache(ScoreInvalidationService.LEADERBOARD_CACHE).get(7L));
        org.junit.jupiter.api.Assertions.assertNotNull(
                cacheManager.getCache(ScoreInvalidationService.LEADERBOARD_CACHE).get(8L));
    }

    @Test
    @DisplayName("Sin Mundial dado de alta no hay nada que invalidar")
    void doesNothingWithoutWorldCup() {
        when(competitionRepository.findIdByExternalId(Competition.WORLD_CUP_EXTERNAL_ID)).thenReturn(Optional.empty());

        assertEquals(0, service.invalidateWorldCup());
        verify(predictionRepository, never()).clearCalculatedScoresByCompetitionId(any());
    }

    @Test
    @DisplayName("Invalida las porras de una edición y vacía la caché de clasificaciones")
    void invalidatesOneEditionAndEvictsTheLeaderboard() {
        when(predictionRepository.clearCalculatedScoresByEditionId(100L)).thenReturn(3);

        assertEquals(3, service.invalidateEdition(100L));
        assertNull(cacheManager.getCache(ScoreInvalidationService.LEADERBOARD_CACHE).get(7L));
        assertEquals(0, service.invalidateEdition(null));
    }
}
