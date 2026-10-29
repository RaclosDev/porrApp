package com.porra.mundial.service;

import com.porra.mundial.model.Competition;
import com.porra.mundial.repository.CompetitionRepository;
import com.porra.mundial.repository.PredictionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Invalida las puntuaciones guardadas de las porras ({@code predictions.score_calculated_at}).
 * <p>
 * La clasificación sirve los puntos guardados mientras todas las porras los tengan calculados, así que
 * hay que llamar aquí cada vez que cambie algo que puntúa los cuadros: clasificación de grupos,
 * resultados de eliminatorias, goleadores o cuadro oficial. Los puntos se recalculan en la siguiente consulta.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ScoreInvalidationService {

    static final String LEADERBOARD_CACHE = "leaderboard";

    private final PredictionRepository predictionRepository;
    private final CompetitionRepository competitionRepository;
    private final CacheManager cacheManager;

    /**
     * Invalida las porras de las ediciones de una competición.
     *
     * @return número de porras invalidadas
     */
    @Transactional
    public int invalidateCompetition(Long competitionId) {
        if (competitionId == null) return 0;
        int cleared = predictionRepository.clearCalculatedScoresByCompetitionId(competitionId);
        if (cleared > 0) {
            log.debug("Puntuaciones de {} porras de la competición {} pendientes de recalcular", cleared, competitionId);
        }
        evictLeaderboardAfterCommit();
        return cleared;
    }

    /**
     * Invalida las porras del Mundial, que es el torneo contra el que se puntúan los cuadros.
     *
     * @return número de porras invalidadas
     */
    @Transactional
    public int invalidateWorldCup() {
        return competitionRepository.findIdByExternalId(Competition.WORLD_CUP_EXTERNAL_ID)
                .map(this::invalidateCompetition)
                .orElse(0);
    }

    /** Vacía la caché de clasificaciones cuando se confirma la transacción, para no servir puntos viejos. */
    private void evictLeaderboardAfterCommit() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    clearLeaderboardCache();
                }
            });
        } else {
            clearLeaderboardCache();
        }
    }

    private void clearLeaderboardCache() {
        Cache cache = cacheManager.getCache(LEADERBOARD_CACHE);
        if (cache != null) cache.clear();
    }
}
