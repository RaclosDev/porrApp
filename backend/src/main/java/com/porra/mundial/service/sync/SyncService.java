package com.porra.mundial.service.sync;

import com.porra.mundial.service.tournament.StandingsService;
import com.porra.mundial.service.tournament.KnockoutBracketService;
import com.porra.mundial.service.tournament.TopScorerService;
import com.porra.mundial.service.prediction.ScoreInvalidationService;
import com.porra.mundial.service.prediction.CustomLockService;
import com.porra.mundial.service.notification.WebSocketService;
import tools.jackson.databind.JsonNode;
import com.porra.mundial.model.Competition;
import com.porra.mundial.model.Match;
import com.porra.mundial.model.Team;
import com.porra.mundial.repository.CompetitionRepository;
import com.porra.mundial.repository.MatchRepository;
import com.porra.mundial.sports.LolEsportsDataProvider;
import com.porra.mundial.sports.SportsDataProvider;
import com.porra.mundial.sports.SportsDataProviderRegistry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

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
    private final TopScorerService topScorerService;
    private final LegacyFixtureRepairService legacyFixtureRepairService;
    private final CustomLockService customLockService;
    private final MatchRepository matchRepository;
    private final SyncLock syncLock;


    /** Un partido cuenta como «en juego» desde 15 min antes del inicio hasta 4 h después si no ha terminado. */
    static final Duration LIVE_LOOKAHEAD = Duration.ofMinutes(15);
    static final Duration LIVE_LOOKBACK = Duration.ofHours(4);

    /** Días por delante que se traen del calendario de las ligas. */
    static final int UPCOMING_DAYS = 14;
    private static final Duration UPCOMING_REFRESH = Duration.ofHours(6);
    /** Última vez que se trajo el calendario de los próximos días de cada competición. */
    private final Map<Long, Instant> lastUpcomingSync = new ConcurrentHashMap<>();

    private volatile Instant lastSyncTime;
    private volatile String lastSyncStatus = "INITIALIZING";
    private volatile int lastMatchesUpdated;
    private volatile int lastTeamsUpdated;
    private volatile String lastErrorMessage;
    /** El último recálculo de la clasificación y el cuadro del Mundial falló: se repite en la siguiente pasada. */
    private volatile boolean worldCupRefreshPending;

    public Instant getLastSyncTime() { return lastSyncTime; }
    public String getLastSyncStatus() { return lastSyncStatus; }
    public int getLastMatchesUpdated() { return lastMatchesUpdated; }
    public int getLastTeamsUpdated() { return lastTeamsUpdated; }
    public String getLastErrorMessage() { return lastErrorMessage; }

    @Scheduled(initialDelay = 60000, fixedDelayString = "${app.sync.interval-ms}")
    @SchedulerLock(name = "fullSync", lockAtMostFor = "PT15M", lockAtLeastFor = "PT1M")
    public void scheduledSync() {
        try {
            syncAll();
        } catch (Exception e) {
            log.warn("Falló la sincronización programada: {}", e.getMessage());
        }
    }

    /**
     * Pasada rápida solo de las competiciones con partidos en juego, para que el marcador en directo no
     * vaya hasta un intervalo completo por detrás. Si no hay nada en juego no llama al proveedor.
     */
    @Scheduled(initialDelay = 90_000, fixedDelayString = "${app.sync.live-interval-ms:60000}")
    @SchedulerLock(name = "liveSync", lockAtMostFor = "PT10M", lockAtLeastFor = "PT20S")
    public void scheduledLiveSync() {
        try {
            syncLive();
        } catch (Exception e) {
            log.warn("Falló la sincronización en directo: {}", e.getMessage());
        }
    }

    /** Repara el histórico por lotes sin competir con una sincronización o importación normal. */
    @Scheduled(initialDelay = 120_000, fixedDelay = 300_000)
    @SchedulerLock(name = "legacyFixtureRepair", lockAtMostFor = "PT15M", lockAtLeastFor = "PT1M")
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
                                   String error, boolean worldCupResultsChanged, int clockUpdated) {
        static CompetitionSync failed(String competition, String status, String error) {
            return new CompetitionSync(competition, status, 0, 0, error, false, 0);
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
                    .filter(SyncService::hasProvider)
                    .toList();
            if (competitions.isEmpty()) {
                log.info("No hay competiciones con proveedor externo que sincronizar.");
                return;
            }
            recordStatus(syncCompetitions(competitions, false));
        } finally {
            syncLock.unlock();
        }
    }

    /**
     * Sincroniza solo las competiciones con algún partido en juego y, de ellas, solo hoy y ayer (partidos tras medianoche).
     * No toca el estado de salud, que resume las pasadas completas.
     */
    public void syncLive() {
        Instant now = Instant.now();
        List<Long> liveIds = matchRepository.findCompetitionIdsWithOpenMatchesBetween(
                now.minus(LIVE_LOOKBACK), now.plus(LIVE_LOOKAHEAD));
        if (liveIds.isEmpty() || !syncLock.tryLock()) return;
        try {
            List<Competition> competitions = competitionRepository.findAllById(liveIds).stream()
                    .filter(SyncService::hasProvider)
                    .toList();
            if (!competitions.isEmpty()) syncCompetitions(competitions, true);
        } finally {
            syncLock.unlock();
        }
    }

    private static boolean hasProvider(Competition competition) {
        return competition.getExternalId() != null && !competition.getExternalId().isBlank();
    }

    /** Sincroniza las competiciones, recalcula el Mundial si hace falta y avisa a los clientes. Requiere {@code syncLock}. */
    private List<CompetitionSync> syncCompetitions(List<Competition> competitions, boolean liveOnly) {
        List<CompetitionSync> results = new ArrayList<>();
        for (Competition competition : competitions) {
            if (Thread.currentThread().isInterrupted()) {
                results.add(CompetitionSync.failed(competition.getName(), STATUS_ERROR, "Sincronización interrumpida"));
                break;
            }
            results.add(syncCompetition(competition, liveOnly));
        }
        worldCupRefreshPending |= results.stream().anyMatch(CompetitionSync::worldCupResultsChanged);
        if (worldCupRefreshPending && !Thread.currentThread().isInterrupted()) {
            results.add(refreshWorldCup(competitions));
            topScorerService.refresh();
        }
        if (results.stream().anyMatch(r -> r.matchesUpdated() > 0 || r.teamsUpdated() > 0)) {
            webSocketService.notifyResultsChanged();
        } else if (results.stream().anyMatch(r -> r.clockUpdated() > 0)) {
            // Solo ha avanzado el minuto de juego: no se vacían las clasificaciones.
            webSocketService.notifyClockChanged();
        }
        return results;
    }

    private CompetitionSync syncCompetition(Competition competition, boolean liveOnly) {
        long start = System.currentTimeMillis();
        SportsDataProvider provider = sportsDataProviderRegistry.getProviderForCompetition(competition.getExternalId());
        String slug = competition.getExternalId();
        if (!provider.isAvailable()) {
            log.warn("Sincronización de {} omitida: el circuit breaker de {} está abierto",
                    competition.getName(), provider.getProviderName());
            return CompetitionSync.failed(competition.getName(), STATUS_CIRCUIT_OPEN, "circuit breaker abierto");
        }
        MatchEventProcessor.Batch batch = new MatchEventProcessor.Batch(competition);
        boolean worldCup = WorldCupTables.isWorldCup(competition);
        try {
            Map<String, Team> teams = matchEventProcessor.teamCache();

            if (worldCup) {
                processEvents(provider.fetchScoreboardEvents(slug, WORLD_CUP_DATE_RANGE), teams, batch);
            } else if (LolEsportsDataProvider.isLolCompetition(slug)) {
                // El calendario de lolesports llega entero de una vez (y en caché) e incluye ediciones
                // anteriores: se repasa la temporada en curso para que las series ya jugadas reciban su fase.
                String season = String.valueOf(LocalDate.now().getYear());
                processEvents(provider.fetchScoreboardEvents(slug, season), teams, batch);
            } else {
                LocalDate today = LocalDate.now();
                List<LocalDate> days = liveOnly
                        ? List.of(today, today.minusDays(1))
                        : List.of(today.minusDays(1), today, today.plusDays(1));
                for (LocalDate day : days) {
                    try {
                        processEvents(provider.fetchScoreboardEvents(slug, day.format(ESPN_DATE)), teams, batch);
                    } catch (Exception e) {
                        batch.recordError(day + ": " + e.getMessage());
                    }
                }
                if (!liveOnly) syncUpcomingDays(competition, provider, teams, batch, today);
            }

            if (batch.resultsChanged()) {
                scoreInvalidationService.invalidateCompetition(competition.getId());
            }
            if (batch.matchesUpdated() > 0) customLockService.refreshFirstMatchLocks(competition.getId());
            log.info("Sincronización de {} con {}: {} equipos y {} partidos actualizados en {} ms",
                    competition.getName(), provider.getProviderName(), batch.teamsUpdated(), batch.matchesUpdated(),
                    System.currentTimeMillis() - start);

            // Si el breaker se ha abierto durante la pasada, las respuestas vacías no eran datos reales.
            boolean available = provider.isAvailable();
            return new CompetitionSync(competition.getName(), batch.hasErrors() ? STATUS_ERROR : available ? STATUS_SUCCESS : STATUS_CIRCUIT_OPEN,
                    batch.matchesUpdated(), batch.teamsUpdated(), batch.hasErrors() ? batch.errorMessage() : available ? null : "circuit breaker abierto",
                    worldCup && batch.resultsChanged(), batch.clockUpdated());
        } catch (Exception e) {
            log.error("Falló la sincronización de {} con {}: {}", competition.getName(), provider.getProviderName(), e.getMessage(), e);
            // Lo que ya se haya guardado antes del fallo también cuenta para el aviso y el recálculo.
            return new CompetitionSync(competition.getName(), STATUS_ERROR, batch.matchesUpdated(),
                    batch.teamsUpdated(), e.getMessage(), worldCup && batch.resultsChanged(), batch.clockUpdated());
        }
    }

    /**
     * Trae el calendario de las dos próximas semanas para que la siguiente jornada se pueda pronosticar antes
     * de que empiece. Es una consulta por día, así que se hace como mucho cada {@link #UPCOMING_REFRESH}; un
     * fallo no marca la pasada como errónea (los partidos cercanos ya se han sincronizado) y se reintenta en la
     * siguiente.
     */
    private void syncUpcomingDays(Competition competition, SportsDataProvider provider, Map<String, Team> teams,
                                  MatchEventProcessor.Batch batch, LocalDate today) {
        Instant now = Instant.now();
        Instant last = lastUpcomingSync.get(competition.getId());
        if (last != null && now.isBefore(last.plus(UPCOMING_REFRESH))) return;
        boolean complete = true;
        for (int offset = 2; offset <= UPCOMING_DAYS; offset++) {
            if (Thread.currentThread().isInterrupted() || !provider.isAvailable()) {
                complete = false;
                break;
            }
            LocalDate day = today.plusDays(offset);
            try {
                processEvents(provider.fetchScoreboardEvents(competition.getExternalId(), day.format(ESPN_DATE)), teams, batch);
            } catch (Exception e) {
                complete = false;
                log.warn("No se pudo traer el calendario de {} del {}: {}", competition.getName(), day, e.getMessage());
            }
        }
        if (complete) lastUpcomingSync.put(competition.getId(), now);
    }

    /**
     * Recalcula la clasificación de grupos y el cuadro del Mundial al final de una pasada. Si falla, se
     * repite en la siguiente aunque esa no cambie ningún resultado.
     */
    private CompetitionSync refreshWorldCup(List<Competition> competitions) {
        String name = competitions.stream().filter(WorldCupTables::isWorldCup).map(Competition::getName)
                .findFirst().orElse(Competition.WORLD_CUP_EXTERNAL_ID);
        worldCupRefreshPending = true;
        try {
            int placed = WorldCupTables.refresh(knockoutBracketService, standingsService);
            worldCupRefreshPending = false;
            return new CompetitionSync(name, STATUS_SUCCESS, placed, 0, null, false, 0);
        } catch (Exception e) {
            log.error("Falló el recálculo de la clasificación y el cuadro de {}: {}", name, e.getMessage(), e);
            return CompetitionSync.failed(name, STATUS_ERROR, e.getMessage());
        }
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

        lastSyncTime = Instant.now();
        lastSyncStatus = status;
        lastMatchesUpdated = results.stream().mapToInt(CompetitionSync::matchesUpdated).sum();
        lastTeamsUpdated = results.stream().mapToInt(CompetitionSync::teamsUpdated).sum();
        lastErrorMessage = errors;
    }
}
