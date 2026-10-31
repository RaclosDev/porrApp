package com.porra.mundial.service;

import tools.jackson.databind.JsonNode;
import com.porra.mundial.model.Competition;
import com.porra.mundial.model.Match;
import com.porra.mundial.model.Team;
import com.porra.mundial.repository.CompetitionRepository;
import com.porra.mundial.sports.SportsDataProvider;
import com.porra.mundial.sports.SportsDataProviderRegistry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.ReentrantLock;

/**
 * Sincroniza partidos y resultados con el proveedor deportivo de cada competición.
 * <ul>
 *   <li>El Mundial se sincroniza entero en cada pasada; las ligas, solo de ayer a mañana.</li>
 *   <li>Si una pasada cambia algún resultado del Mundial, al final se actualizan una vez su cuadro de
 *       eliminatorias y su clasificación de grupos. Si cambia algo, se avisa a los clientes.</li>
 *   <li>El estado de la última pasada, con todas sus competiciones, se expone para el health check
 *       ({@code SyncHealthIndicator}).</li>
 *   <li>El circuit breaker de ESPN está en el proveedor: con él abierto, la competición no se da por sincronizada.</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SyncService {

    private static final String WORLD_CUP_DATE_RANGE = "2026";
    private static final DateTimeFormatter ESPN_DATE = DateTimeFormatter.ofPattern("yyyyMMdd");
    /** Lo que espera una importación a que termine la sincronización en curso. */
    private static final long IMPORT_LOCK_TIMEOUT_MINUTES = 5;

    static final String STATUS_SUCCESS = "success";
    static final String STATUS_ERROR = "error";
    static final String STATUS_CIRCUIT_OPEN = "circuit_breaker_open";

    private final CompetitionRepository competitionRepository;
    private final SportsDataProviderRegistry sportsDataProviderRegistry;
    private final MatchEventProcessor matchEventProcessor;
    private final KnockoutBracketService knockoutBracketService;
    private final StandingsService standingsService;
    private final WebSocketService webSocketService;
    private final ScoreInvalidationService scoreInvalidationService;
    private final PlatformTransactionManager transactionManager;
    private final TopScorerService topScorerService;
    private final LegacyFixtureRepairService legacyFixtureRepairService;

    private final ReentrantLock syncLock = new ReentrantLock();

    private volatile LocalDateTime lastSyncTime;
    private volatile String lastSyncStatus = "INITIALIZING";
    private volatile int lastMatchesUpdated;
    private volatile int lastTeamsUpdated;
    private volatile String lastErrorMessage;
    /** El último recálculo de la clasificación y el cuadro del Mundial falló: se repite en la siguiente pasada. */
    private volatile boolean worldCupRefreshPending;

    /** Resultado de importar el catálogo y calendario de una competición. */
    public record ImportResult(String competition, int importedTeams, int importedMatches) {
    }

    public LocalDateTime getLastSyncTime() { return lastSyncTime; }
    public String getLastSyncStatus() { return lastSyncStatus; }
    public int getLastMatchesUpdated() { return lastMatchesUpdated; }
    public int getLastTeamsUpdated() { return lastTeamsUpdated; }
    public String getLastErrorMessage() { return lastErrorMessage; }

    @Scheduled(initialDelay = 60000, fixedDelayString = "${app.sync.interval-ms}")
    public void scheduledSync() {
        try {
            syncAll();
        } catch (Exception e) {
            log.warn("Falló la sincronización programada: {}", e.getMessage());
        }
    }

    /** Repara el histórico por lotes sin competir con una sincronización o importación normal. */
    @Scheduled(initialDelay = 120_000, fixedDelay = 300_000)
    public void repairLegacyFixtures() {
        if (!syncLock.tryLock()) return;
        try {
            var result = legacyFixtureRepairService.repairBatch();
            if (result.attempted() > 0) {
                log.info("Reparación histórica: {} consultados, {} reparados, {} pendientes de reintento",
                        result.attempted(), result.repaired(), result.failed());
            }
        } catch (Exception error) {
            log.warn("Falló la reparación de partidos históricos: {}", error.getMessage(), error);
        } finally {
            syncLock.unlock();
        }
    }

    /** Resultado de sincronizar una competición en una pasada. */
    private record CompetitionSync(String competition, String status, int matchesUpdated, int teamsUpdated,
                                   String error, boolean worldCupResultsChanged) {
        static CompetitionSync failed(String competition, String status, String error) {
            return new CompetitionSync(competition, status, 0, 0, error, false);
        }
    }

    /**
     * Sincroniza todas las competiciones con proveedor externo. Si ya hay una pasada en curso, no hace nada.
     * La clasificación de grupos y el cuadro del Mundial se recalculan una vez al final, y solo si la pasada
     * ha cambiado algún resultado del Mundial (o si el recálculo anterior falló).
     * El estado de salud resume la pasada entera: basta con que falle una competición para que no sea "success".
     */
    public void syncAll() {
        if (!syncLock.tryLock()) {
            log.info("Sincronización omitida: ya hay otra en curso.");
            return;
        }
        try {
            List<Competition> competitions = competitionRepository.findAll().stream()
                    .filter(c -> c.getExternalId() != null && !c.getExternalId().isBlank())
                    .toList();
            if (competitions.isEmpty()) {
                log.info("No hay competiciones con proveedor externo que sincronizar.");
                return;
            }
            List<CompetitionSync> results = new ArrayList<>();
            for (Competition competition : competitions) {
                if (Thread.currentThread().isInterrupted()) {
                    results.add(CompetitionSync.failed(competition.getName(), STATUS_ERROR, "Sincronización interrumpida"));
                    break;
                }
                results.add(syncCompetition(competition));
            }
            worldCupRefreshPending |= results.stream().anyMatch(CompetitionSync::worldCupResultsChanged);
            if (worldCupRefreshPending && !Thread.currentThread().isInterrupted()) {
                results.add(refreshWorldCup(competitions));
                topScorerService.refresh();
            }
            if (results.stream().anyMatch(r -> r.matchesUpdated() > 0 || r.teamsUpdated() > 0)) {
                webSocketService.notifyResultsChanged();
            }
            recordStatus(results);
        } finally {
            syncLock.unlock();
        }
    }

    private CompetitionSync syncCompetition(Competition competition) {
        long start = System.currentTimeMillis();
        SportsDataProvider provider = sportsDataProviderRegistry.getProviderForCompetition(competition.getName());
        String slug = competition.getExternalId();
        if (!provider.isAvailable()) {
            log.warn("Sincronización de {} omitida: el circuit breaker de {} está abierto",
                    competition.getName(), provider.getProviderName());
            return CompetitionSync.failed(competition.getName(), STATUS_CIRCUIT_OPEN, "circuit breaker abierto");
        }
        MatchEventProcessor.Batch batch = new MatchEventProcessor.Batch(competition);
        boolean worldCup = isWorldCup(competition);
        try {
            Map<String, Team> teams = matchEventProcessor.teamCache();

            if (worldCup) {
                processEvents(provider.fetchScoreboardEvents(slug, WORLD_CUP_DATE_RANGE), teams, batch);
            } else {
                LocalDate today = LocalDate.now();
                for (LocalDate day : List.of(today.minusDays(1), today, today.plusDays(1))) {
                    try {
                        processEvents(provider.fetchScoreboardEvents(slug, day.format(ESPN_DATE)), teams, batch);
                    } catch (Exception e) {
                        batch.recordError(day + ": " + e.getMessage());
                    }
                }
            }

            if (batch.resultsChanged()) {
                scoreInvalidationService.invalidateCompetition(competition.getId());
            }
            log.info("Sincronización de {} con {}: {} equipos y {} partidos actualizados en {} ms",
                    competition.getName(), provider.getProviderName(), batch.teamsUpdated(), batch.matchesUpdated(),
                    System.currentTimeMillis() - start);

            // Si el breaker se ha abierto durante la pasada, las respuestas vacías no eran datos reales.
            boolean available = provider.isAvailable();
            return new CompetitionSync(competition.getName(), batch.hasErrors() ? STATUS_ERROR : available ? STATUS_SUCCESS : STATUS_CIRCUIT_OPEN,
                    batch.matchesUpdated(), batch.teamsUpdated(), batch.hasErrors() ? batch.errorMessage() : available ? null : "circuit breaker abierto",
                    worldCup && batch.resultsChanged());
        } catch (Exception e) {
            log.error("Falló la sincronización de {} con {}: {}", competition.getName(), provider.getProviderName(), e.getMessage(), e);
            // Lo que ya se haya guardado antes del fallo también cuenta para el aviso y el recálculo.
            return new CompetitionSync(competition.getName(), STATUS_ERROR, batch.matchesUpdated(),
                    batch.teamsUpdated(), e.getMessage(), worldCup && batch.resultsChanged());
        }
    }

    /**
     * Importa el catálogo de equipos (con escudos) y el calendario de la temporada de una competición.
     * Se usa al crear la primera liga de una competición sin partidos.
     * <p>
     * Comparte el cerrojo de la sincronización programada, para que las dos no creen el mismo partido a
     * la vez, y lo mantiene hasta confirmar la transacción.
     */
    public ImportResult importCompetitionData(Long competitionId) {
        try {
            if (!syncLock.tryLock(IMPORT_LOCK_TIMEOUT_MINUTES, TimeUnit.MINUTES)) {
                throw new IllegalStateException("Hay una sincronización en curso; no se ha podido importar la competición " + competitionId);
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Importación interrumpida de la competición " + competitionId, e);
        }
        try {
            ImportResult result = new TransactionTemplate(transactionManager).execute(status -> doImportCompetitionData(competitionId));
            if (competitionRepository.findById(competitionId).filter(SyncService::isWorldCup).isPresent()) {
                topScorerService.refresh();
            }
            return result;
        } finally {
            syncLock.unlock();
        }
    }

    private ImportResult doImportCompetitionData(Long competitionId) {
        Competition competition = competitionRepository.findById(competitionId)
                .orElseThrow(() -> new IllegalArgumentException("Competición no encontrada con ID: " + competitionId));
        String slug = competition.getExternalId();
        if (slug == null || slug.isBlank()) {
            throw new IllegalArgumentException("La competición '" + competition.getName() + "' no tiene proveedor externo configurado");
        }

        SportsDataProvider provider = sportsDataProviderRegistry.getProviderForCompetition(competition.getName());
        Map<String, Team> teams = matchEventProcessor.teamCache();
        int importedTeams;
        try {
            importedTeams = matchEventProcessor.importTeams(provider.fetchTeams(slug), teams);
        } catch (Exception e) {
            throw new IllegalStateException("No se pudieron descargar los equipos de " + competition.getName(), e);
        }

        // ESPN acepta un año natural en `dates`. Se consulta desde el año de inicio de la temporada
        // hasta el siguiente para cubrir temporadas que cruzan de año (ago 2026 - may 2027).
        MatchEventProcessor.Batch batch = new MatchEventProcessor.Batch(competition);
        LocalDate today = LocalDate.now();
        int startYear = today.getMonthValue() >= 7 ? today.getYear() : today.getYear() - 1;
        LocalDateTime windowStart = today.minusMonths(3).atStartOfDay();
        LocalDateTime windowEnd = today.plusMonths(12).atStartOfDay();
        Set<String> seenEventIds = new HashSet<>();

        for (int year = startYear; year <= today.getYear() + 1; year++) {
            try {
                JsonNode events = provider.fetchScoreboardEvents(slug, String.valueOf(year));
                if (events == null || !events.isArray()) continue;
                for (JsonNode event : events) {
                    String eventId = event.path("id").asText(null);
                    if (eventId == null || !seenEventIds.add(eventId)) continue;
                    LocalDateTime date = matchEventProcessor.parseDate(event.path("date").asText(null));
                    if (date != null && (date.isBefore(windowStart) || date.isAfter(windowEnd))) continue;
                    processEvent(event, teams, batch);
                }
            } catch (Exception e) {
                batch.recordError(year + ": " + e.getMessage());
            }
        }

        if (batch.resultsChanged()) {
            if (isWorldCup(competition)) {
                updateWorldCupStandingsAndBracket();
            }
            scoreInvalidationService.invalidateCompetition(competition.getId());
        }
        if (batch.hasErrors()) throw new IllegalStateException("Importación incompleta: " + batch.errorMessage());
        log.info("Importados {} equipos y {} partidos de {}", importedTeams, batch.matchesUpdated(), competition.getName());
        return new ImportResult(competition.getName(), importedTeams, batch.matchesUpdated());
    }

    private static boolean isWorldCup(Competition competition) {
        return Competition.WORLD_CUP_EXTERNAL_ID.equalsIgnoreCase(competition.getExternalId());
    }

    /**
     * Recalcula la clasificación de grupos y el cuadro del Mundial al final de una pasada. Si falla, se
     * repite en la siguiente aunque esa no cambie ningún resultado.
     */
    private CompetitionSync refreshWorldCup(List<Competition> competitions) {
        String name = competitions.stream().filter(SyncService::isWorldCup).map(Competition::getName)
                .findFirst().orElse(Competition.WORLD_CUP_EXTERNAL_ID);
        worldCupRefreshPending = true;
        try {
            int placed = updateWorldCupStandingsAndBracket();
            worldCupRefreshPending = false;
            return new CompetitionSync(name, STATUS_SUCCESS, placed, 0, null, false);
        } catch (Exception e) {
            log.error("Falló el recálculo de la clasificación y el cuadro de {}: {}", name, e.getMessage(), e);
            return CompetitionSync.failed(name, STATUS_ERROR, e.getMessage());
        }
    }

    /**
     * Coloca a los ganadores de las eliminatorias y recalcula la clasificación de grupos con una sola
     * lectura de los partidos del Mundial: solo el Mundial tiene grupos y cuadro oficiales.
     *
     * @return número de partidos de eliminatorias actualizados
     */
    private int updateWorldCupStandingsAndBracket() {
        List<Match> worldCupMatches = knockoutBracketService.worldCupMatches();
        int placed = knockoutBracketService.propagateKnockoutWinners(worldCupMatches);
        standingsService.recalculateStandingsFromMatches(worldCupMatches);
        return placed;
    }

    private void processEvents(JsonNode events, Map<String, Team> teams, MatchEventProcessor.Batch batch) {
        if (events == null || !events.isArray()) return;
        for (JsonNode event : events) {
            if (Thread.currentThread().isInterrupted()) throw new IllegalStateException("Sincronización interrumpida");
            processEvent(event, teams, batch);
        }
    }

    /** Un evento que no se puede procesar se salta: no tiene que abortar la pasada entera. */
    private void processEvent(JsonNode event, Map<String, Team> teams, MatchEventProcessor.Batch batch) {
        try {
            matchEventProcessor.process(event, teams, batch);
        } catch (Exception e) {
            batch.recordError("Evento " + event.path("id").asText("?") + ": " + e.getMessage());
            log.warn("Evento {} de {} omitido: {}", event.path("id").asText("?"),
                    batch.competitionName(), e.getMessage(), e);
        }
    }

    /**
     * Guarda el resumen de la pasada: "success" solo si todas las competiciones lo son; si alguna ha
     * fallado, "error" (o "circuit_breaker_open" si todas las que fallan es por el breaker), con los
     * errores de cada una.
     */
    private void recordStatus(List<CompetitionSync> results) {
        List<CompetitionSync> failed = results.stream().filter(r -> !STATUS_SUCCESS.equals(r.status())).toList();
        String status;
        if (failed.isEmpty()) {
            status = STATUS_SUCCESS;
        } else if (failed.stream().allMatch(r -> STATUS_CIRCUIT_OPEN.equals(r.status()))) {
            status = STATUS_CIRCUIT_OPEN;
        } else {
            status = STATUS_ERROR;
        }
        String errors = failed.isEmpty() ? null : failed.stream()
                .map(r -> r.competition() + ": " + r.error())
                .collect(java.util.stream.Collectors.joining("; "));

        lastSyncTime = LocalDateTime.now();
        lastSyncStatus = status;
        lastMatchesUpdated = results.stream().mapToInt(CompetitionSync::matchesUpdated).sum();
        lastTeamsUpdated = results.stream().mapToInt(CompetitionSync::teamsUpdated).sum();
        lastErrorMessage = errors;
    }
}
