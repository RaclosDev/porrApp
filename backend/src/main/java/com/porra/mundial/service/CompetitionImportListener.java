package com.porra.mundial.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Importa el calendario de una competición cuando ya se ha confirmado la liga que lo pide.
 * <p>
 * Va fuera de la petición y de su transacción: si la importación fallase dentro, marcaría la
 * transacción de la liga para deshacerse y crear la liga fallaría por un problema de ESPN.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class CompetitionImportListener {

    private final SyncService syncService;

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onImportRequested(CompetitionImportRequestedEvent event) {
        try {
            syncService.importCompetitionData(event.competitionId());
        } catch (Exception e) {
            // El arranque reintenta las competiciones con ligas activas y sin partidos.
            log.warn("No se pudo importar la competición {}: {}", event.competitionId(), e.getMessage());
        }
    }
}
