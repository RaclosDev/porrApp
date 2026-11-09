package app.porrapp.config;

import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;
import app.porrapp.model.Competition;
import app.porrapp.model.CompetitionTeam;
import app.porrapp.model.TournamentFormat;
import app.porrapp.model.Team;
import app.porrapp.repository.CompetitionRepository;
import app.porrapp.repository.CompetitionTeamRepository;
import app.porrapp.repository.EditionRepository;
import app.porrapp.repository.MatchRepository;
import app.porrapp.repository.TeamRepository;
import app.porrapp.service.tournament.KnockoutBracketService;
import app.porrapp.service.tournament.StandingsService;
import app.porrapp.service.sync.CompetitionImportService;
import app.porrapp.service.sync.SyncService;
import app.porrapp.sports.TennisTournaments;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.cache.CacheManager;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.InputStream;
import java.util.List;


/**
 * Prepara los datos base al arrancar:
 * <ul>
 *   <li>las competiciones del catálogo ({@code seed/competitions.json}),</li>
 *   <li>los equipos de los torneos con grupos que aún no los tienen,</li>
 *   <li>una sincronización inicial en segundo plano para que Tomcat arranque sin esperar a ESPN.</li>
 * </ul>
 * Las correcciones de datos puntuales van en migraciones de Flyway, no aquí.
 */
@Component
@org.springframework.core.annotation.Order(1)
@RequiredArgsConstructor
@Slf4j
public class DataInitializer implements CommandLineRunner {

    /** Catálogo de competiciones oficiales que existen desde el primer arranque. */
    static final String COMPETITIONS_SEED = "seed/competitions.json";

    /**
     * Torneos ya jugados que sirven de banco de pruebas (un segundo torneo con grupos de otra forma): solo
     * se dan de alta donde se pide, nunca en producción.
     */
    static final String PAST_COMPETITIONS_SEED = "seed/competitions-past.json";

    @org.springframework.beans.factory.annotation.Value("${app.seed.past-tournaments:false}")
    boolean seedPastTournaments;

    private final CompetitionRepository competitionRepository;
    private final TeamRepository teamRepository;
    private final CompetitionTeamRepository competitionTeamRepository;
    private final EditionRepository editionRepository;
    private final MatchRepository matchRepository;
    private final SyncService syncService;
    private final CompetitionImportService importService;
    private final StandingsService standingsService;
    private final KnockoutBracketService knockoutBracketService;
    private final ObjectMapper objectMapper;
    private final InitialSyncExecutor initialSyncExecutor;
    private final CacheManager cacheManager;

    /**
     * Competición del catálogo.
     *
     * @param teams fichero con los equipos sorteados en sus grupos; null si los trae el proveedor al importar
     */
    record CompetitionSeed(String name, String externalId, String formatType, String teams) {
    }

    /**
     * Equipo del fichero de semilla.
     *
     * @param nameEn     nombre con el que lo da el proveedor, para que la importación lo reconozca
     * @param externalId su id en el proveedor
     * @param winOdds    probabilidades iniciales, si el torneo las tiene
     */
    record TeamSeed(String name, String nameEn, String externalId, String group,
                    Double winOdds, Double qualifyOdds, Double outrightOdds) {
    }

    /**
     * Añadir una competición es añadir una línea al catálogo. Los cuadros de tenis salen de
     * {@link TennisTournaments}, que además sabe leerlos de ESPN.
     */
    @Override
    @Transactional
    public void run(String... args) {
        List<CompetitionSeed> catalogue = new java.util.ArrayList<>(readSeed(COMPETITIONS_SEED, new TypeReference<>() {
        }));
        if (seedPastTournaments) {
            catalogue.addAll(readSeed(PAST_COMPETITIONS_SEED, new TypeReference<List<CompetitionSeed>>() {
            }));
        }
        for (CompetitionSeed seed : catalogue) {
            seedCompetitionIfMissing(seed.name(), seed.externalId(), seed.formatType());
        }
        for (TennisTournaments.Tournament tournament : TennisTournaments.ALL) {
            for (TennisTournaments.Draw draw : tournament.draws()) {
                seedCompetitionIfMissing(tournament.competitionName(draw), tournament.externalId(draw), "TOURNAMENT");
            }
        }
        catalogue.stream().filter(seed -> seed.teams() != null).forEach(this::seedTeamsIfMissing);
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
            // El servidor ya atiende peticiones mientras se siembra: una lista de competiciones pedida
            // antes quedaría en caché sin la nueva hasta la barrida diaria.
            var cache = cacheManager.getCache("competitions");
            if (cache != null) cache.clear();
        }
    }

    /**
     * Equipos de un torneo con grupos, si aún no tiene ninguno. Un equipo que ya existe (juega otra
     * competición) se reutiliza: su grupo es el de su participación en este torneo, no el del equipo.
     */
    private void seedTeamsIfMissing(CompetitionSeed competitionSeed) {
        Competition competition = competitionRepository.findByExternalId(competitionSeed.externalId()).orElse(null);
        if (competition == null || competitionTeamRepository.existsByCompetitionId(competition.getId())) {
            return;
        }
        List<TeamSeed> seeds = readSeed(competitionSeed.teams(), new TypeReference<>() {
        });
        seeds.forEach(seed -> {
            Team team = existingTeam(seed)
                    .orElseGet(() -> teamRepository.save(Team.builder()
                            .name(seed.name())
                            .nameEn(seed.nameEn())
                            .externalId(seed.externalId())
                            .winOdds(seed.winOdds())
                            .qualifyOdds(seed.qualifyOdds())
                            .outrightOdds(seed.outrightOdds())
                            .build()));
            competitionTeamRepository.save(CompetitionTeam.builder()
                    .competition(competition).team(team).groupName(seed.group()).build());
        });
        log.info("Cargados {} equipos de {} desde {}", seeds.size(), competition.getName(), competitionSeed.teams());
    }

    private java.util.Optional<Team> existingTeam(TeamSeed seed) {
        java.util.Optional<Team> byId = seed.externalId() == null
                ? java.util.Optional.empty() : teamRepository.findByExternalId(seed.externalId());
        return byId.isPresent() ? byId : teamRepository.findByName(seed.name());
    }

    private <T> T readSeed(String resource, TypeReference<T> type) {
        try (InputStream in = new ClassPathResource(resource).getInputStream()) {
            return objectMapper.readValue(in, type);
        } catch (IOException e) {
            throw new IllegalStateException("No se pudo leer " + resource, e);
        }
    }

    /**
     * Importa el calendario de las competiciones con ligas activas que aún no tienen partidos (y el de
     * los torneos ya jugados de prueba), sincroniza resultados y recalcula clasificaciones. Cada paso es
     * independiente: si uno falla, el siguiente se intenta igualmente y el job programado de
     * {@link SyncService} lo reintentará.
     */
    private void runInitialSync() {
        runStep("importar calendarios vacíos", this::importEmptyCompetitionFixtures);
        runStep("importar los torneos ya jugados", this::importPastTournaments);
        runStep("sincronizar resultados", syncService::syncAll);
        runStep("reparar equipos históricos", syncService::repairLegacyFixtures);
        runStep("recalcular los torneos con grupos", this::refreshGroupTournaments);
        log.info("Sincronización inicial de arranque finalizada.");
    }

    /**
     * Clasificación de grupos y cruces de cada torneo con grupos. Con el torneo cerrado y su clasificación
     * ya guardada no hay nada que pueda cambiar: rehacerlo en cada despliegue solo repetía lecturas y escrituras.
     */
    private void refreshGroupTournaments() {
        for (Competition tournament : competitionRepository.findByExternalIdIn(TournamentFormat.registeredExternalIds())) {
            if (knockoutBracketService.isOver(tournament) && standingsService.hasStandings(tournament)) continue;
            runStep("recalcular la clasificación de " + tournament.getName(), () -> standingsService.recalculate(tournament));
            runStep("propagar ganadores de " + tournament.getName(),
                    () -> knockoutBracketService.propagateKnockoutWinners(tournament));
        }
    }

    private void importEmptyCompetitionFixtures() {
        editionRepository.findActiveCanonicalCompetitionIds().stream()
                .distinct()
                .filter(competitionId -> matchRepository.countByCompetitionId(competitionId) == 0)
                .forEach(competitionId -> competitionRepository.findById(competitionId).ifPresent(competition ->
                        runStep("importar el calendario de " + competition.getName(),
                                () -> importService.importCompetitionData(competition.getId()))));
    }

    /**
     * Partidos de los torneos ya jugados de prueba, la primera vez: ninguna liga los juega, así que nadie
     * más los pediría, y su cuadro y sus grupos oficiales saldrían vacíos. Solo donde se siembran.
     */
    private void importPastTournaments() {
        if (!seedPastTournaments) return;
        List<CompetitionSeed> past = readSeed(PAST_COMPETITIONS_SEED, new TypeReference<>() {
        });
        for (CompetitionSeed seed : past) {
            competitionRepository.findByExternalId(seed.externalId())
                    .filter(competition -> matchRepository.countByCompetitionId(competition.getId()) == 0)
                    .ifPresent(competition -> runStep("importar los partidos de " + competition.getName(),
                            () -> importService.importCompetitionData(competition.getId())));
        }
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
