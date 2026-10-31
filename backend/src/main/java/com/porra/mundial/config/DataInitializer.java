package com.porra.mundial.config;

import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;
import com.porra.mundial.model.Competition;
import com.porra.mundial.model.Team;
import com.porra.mundial.repository.CompetitionRepository;
import com.porra.mundial.repository.EditionRepository;
import com.porra.mundial.repository.MatchRepository;
import com.porra.mundial.repository.TeamRepository;
import com.porra.mundial.service.KnockoutBracketService;
import com.porra.mundial.service.StandingsService;
import com.porra.mundial.service.SyncService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.InputStream;
import java.util.List;


/**
 * Prepara los datos base al arrancar:
 * <ul>
 *   <li>las competiciones soportadas,</li>
 *   <li>los equipos del Mundial 2026 si la base de datos está vacía,</li>
 *   <li>una sincronización inicial en segundo plano para que Tomcat arranque sin esperar a ESPN.</li>
 * </ul>
 * Las correcciones de datos puntuales van en migraciones de Flyway, no aquí.
 */
@Component
@org.springframework.core.annotation.Order(1)
@RequiredArgsConstructor
@Slf4j
public class DataInitializer implements CommandLineRunner {

    private static final String WORLD_CUP_TEAMS_SEED = "seed/world-cup-2026-teams.json";

    private final CompetitionRepository competitionRepository;
    private final TeamRepository teamRepository;
    private final EditionRepository editionRepository;
    private final MatchRepository matchRepository;
    private final SyncService syncService;
    private final StandingsService standingsService;
    private final KnockoutBracketService knockoutBracketService;
    private final ObjectMapper objectMapper;
    private final InitialSyncExecutor initialSyncExecutor;

    /** Equipo del fichero de semilla con sus probabilidades iniciales. */
    record TeamSeed(String name, String group, double winOdds, double qualifyOdds, double outrightOdds) {
    }

    @Override
    @Transactional
    public void run(String... args) {
        seedCompetitionIfMissing("FIFA World Cup 2026", Competition.WORLD_CUP_EXTERNAL_ID, "TOURNAMENT");
        seedCompetitionIfMissing("LaLiga EA Sports", "esp.1", "LEAGUE");
        seedCompetitionIfMissing("UEFA Champions League", "uefa.champions", "LEAGUE");
        seedCompetitionIfMissing("Premier League", "eng.1", "LEAGUE");

        seedWorldCupTeamsIfMissing();


    }

    @org.springframework.context.event.EventListener(org.springframework.boot.context.event.ApplicationReadyEvent.class)
    public void startInitialSync() {
        initialSyncExecutor.execute(this::runInitialSync);
    }

    private void seedCompetitionIfMissing(String name, String externalId, String formatType) {
        if (competitionRepository.findByExternalId(externalId).isEmpty()
                && competitionRepository.findByName(name).isEmpty()) {
            competitionRepository.save(Competition.builder()
                    .name(name)
                    .externalId(externalId)
                    .formatType(formatType)
                    .build());
        }
    }

    private void seedWorldCupTeamsIfMissing() {
        // Se mira si ya hay equipos con grupo, no si la tabla está vacía: en una base nueva existen
        // el comodín "Por definir" y los equipos que crean las migraciones de datos (V33.1).
        if (teamRepository.existsByGroupNameIsNotNullAndGroupNameNot("-")) {
            return;
        }
        List<TeamSeed> seeds = readTeamSeeds();
        seeds.forEach(seed -> teamRepository.save(Team.builder()
                .name(seed.name())
                .groupName(seed.group())
                .winOdds(seed.winOdds())
                .qualifyOdds(seed.qualifyOdds())
                .outrightOdds(seed.outrightOdds())
                .build()));
        log.info("Cargados {} equipos del Mundial 2026 desde {}", seeds.size(), WORLD_CUP_TEAMS_SEED);
    }

    private List<TeamSeed> readTeamSeeds() {
        try (InputStream in = new ClassPathResource(WORLD_CUP_TEAMS_SEED).getInputStream()) {
            return objectMapper.readValue(in, new TypeReference<>() {
            });
        } catch (IOException e) {
            throw new IllegalStateException("No se pudo leer " + WORLD_CUP_TEAMS_SEED, e);
        }
    }

    /**
     * Importa el calendario de las competiciones con ligas activas que aún no tienen partidos,
     * sincroniza resultados y recalcula clasificaciones. Cada paso es independiente: si uno falla,
     * el siguiente se intenta igualmente y el job programado de {@link SyncService} lo reintentará.
     */
    private void runInitialSync() {
        runStep("importar calendarios vacíos", this::importEmptyCompetitionFixtures);
        runStep("sincronizar resultados", syncService::syncAll);
        runStep("reparar equipos históricos", syncService::repairLegacyFixtures);
        runStep("recalcular clasificaciones", standingsService::recalculateStandingsFromMatches);
        runStep("propagar ganadores de eliminatorias", knockoutBracketService::propagateKnockoutWinners);
        log.info("Sincronización inicial de arranque finalizada.");
    }

    private void importEmptyCompetitionFixtures() {
        editionRepository.findActiveCanonicalCompetitionIds().stream()
                .distinct()
                .filter(competitionId -> matchRepository.countByCompetitionId(competitionId) == 0)
                .forEach(competitionId -> competitionRepository.findById(competitionId).ifPresent(competition ->
                        runStep("importar el calendario de " + competition.getName(),
                                () -> syncService.importCompetitionData(competition.getId()))));
    }

    private void runStep(String description, Runnable step) {
        if (Thread.currentThread().isInterrupted()) return;
        try {
            step.run();
        } catch (Exception e) {
            log.warn("No se pudo {} al arrancar: {}", description, e.getMessage());
        }
    }
}
