package com.porra.mundial.service.sync;

import com.porra.mundial.repository.EditionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Mantiene entero el calendario de la temporada de cada competición oficial con ligas activas.
 * <p>
 * La sincronización frecuente solo mira unos días alrededor de hoy; sin esto, una competición que ya
 * tenía algunos partidos sueltos no recibía nunca el resto de la temporada, y las ligas por jornadas o de
 * superviviente veían jornadas de un solo partido. También recoge los cambios de fecha lejanos.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class SeasonCalendarRefresher {

    private final EditionRepository editionRepository;
    private final CompetitionImportService importService;

    @Scheduled(initialDelay = 240_000, fixedDelay = 12 * 60 * 60 * 1000)
    @SchedulerLock(name = "seasonCalendar", lockAtMostFor = "PT2H", lockAtLeastFor = "PT5M")
    public void refreshActiveSeasons() {
        for (Long competitionId : editionRepository.findActiveCanonicalCompetitionIds().stream().distinct().toList()) {
            if (Thread.currentThread().isInterrupted()) return;
            try {
                var result = importService.importCompetitionData(competitionId);
                log.info("Temporada de {} al día: {} partidos actualizados", result.competition(), result.importedMatches());
            } catch (Exception error) {
                log.warn("No se pudo refrescar la temporada de la competición {}: {}", competitionId, error.getMessage());
            }
        }
    }
}
