package app.porrapp.service.sync;

import app.porrapp.service.tournament.CompetitionPlayerService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Importa el calendario de una competición (y, si la liga juega el pichichi, sus plantillas) cuando ya se ha confirmado la liga que lo pide.
 * <p>
 * Va fuera de la petición y de su transacción: si la importación fallase dentro, marcaría la
 * transacción de la liga para deshacerse y crear la liga fallaría por un problema de ESPN.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class CompetitionImportListener {

    private final CompetitionImportService importService;
    private final CompetitionPlayerService playerService;

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onImportRequested(CompetitionImportRequestedEvent event) {
        try {
            importService.importCompetitionData(event.competitionId());
        } catch (Exception e) {
            // El arranque reintenta las competiciones con ligas activas y sin partidos.
            log.warn("No se pudo importar la competición {}: {}", event.competitionId(), e.getMessage());
        }
        // Las plantillas no dependen del calendario: un fallo en uno no debe impedir el otro.
        try {
            playerService.refreshForNewLeague(event.competitionId());
        } catch (Exception e) {
            log.warn("No se pudieron pedir las plantillas de la competición {}: {}", event.competitionId(), e.getMessage());
        }
    }
}
