package com.porra.mundial.service.sync;

import com.porra.mundial.model.Competition;
import com.porra.mundial.repository.CompetitionRepository;
import com.porra.mundial.service.prediction.MatchSelectionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.cache.CacheManager;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.Comparator;
import java.util.List;

/**
 * Barrida diaria de madrugada: vuelve a cargar del proveedor la temporada entera (equipos, calendario,
 * resultados y jornadas) de todas las competiciones oficiales, tengan ligas o no.
 * <p>
 * La sincronización frecuente solo mira unos días alrededor de hoy. Esta pasada completa el resto de la
 * temporada, recoge los cambios de fecha lejanos y los resultados que se le hayan escapado, y deja lista
 * cualquier competición para cuando alguien cree una liga sobre ella. Va a las 5:00 de Madrid, cuando
 * apenas hay tráfico y no coincide con las limpiezas de las 4:15, 4:30 y 4:45.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class SeasonCalendarRefresher {

    private static final String[] CACHES = {"competitions", "matches", "matchRadar", "standings"};

    private final CompetitionRepository competitionRepository;
    private final CompetitionImportService importService;
    private final CacheManager cacheManager;
    private final MatchSelectionService matchSelectionService;

    @Scheduled(cron = "0 0 5 * * *", zone = "Europe/Madrid")
    @SchedulerLock(name = "seasonCalendar", lockAtMostFor = "PT2H", lockAtLeastFor = "PT5M")
    public void refreshAllSeasons() {
        List<Competition> official = competitionRepository.findAll().stream()
                .filter(c -> c.getOwnerLeague() == null && c.getExternalId() != null && !c.getExternalId().isBlank())
                .sorted(Comparator.comparing(Competition::getId))
                .toList();
        int refreshed = 0;
        for (Competition competition : official) {
            if (Thread.currentThread().isInterrupted()) return;
            try {
                var result = importService.importCompetitionData(competition.getId());
                refreshed++;
                log.info("Barrida diaria: {} al día ({} equipos, {} partidos actualizados)",
                        result.competition(), result.importedTeams(), result.importedMatches());
            } catch (Exception error) {
                // Una competición que falla (ESPN caído, temporada sin publicar) no frena al resto.
                log.warn("Barrida diaria: no se pudo cargar {}: {}", competition.getName(), error.getMessage());
            }
        }
        try {
            // Las ligas de tenis de varios torneos suman los cuadros nuevos de su alcance.
            int added = matchSelectionService.syncTennisScopes();
            if (added > 0) log.info("Barrida diaria: {} cuadros de tenis nuevos en ligas de varios torneos", added);
        } catch (Exception error) {
            log.warn("Barrida diaria: no se pudieron poner al día las ligas de tenis de varios torneos: {}",
                    error.getMessage());
        }
        for (String name : CACHES) {
            var cache = cacheManager.getCache(name);
            if (cache != null) cache.clear();
        }
        log.info("Barrida diaria terminada: {} de {} competiciones al día", refreshed, official.size());
    }
}
