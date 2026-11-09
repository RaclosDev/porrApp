package app.porrapp.service.sync;

import app.porrapp.dto.MatchSelectionDTO;
import app.porrapp.model.Sport;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.CacheManager;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executor;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

/**
 * Carga en el momento una competición oficial que nunca se ha importado, cuando alguien la elige al crear
 * una liga y su calendario sale vacío (sin esto, quedaría vacío hasta la barrida de las 5:00). Usa la misma
 * importación que la barrida.
 * <p>
 * Una sola importación por competición aunque lleguen varias peticiones a la vez, y con freno para no
 * machacar a ESPN: tras un intento, esa competición no se vuelve a pedir en {@link #RETRY_AFTER}, y entre
 * todas no se lanzan más de {@link #MAX_PER_HOUR} por hora. La importación va en segundo plano: el
 * calendario dice «cargando» y el asistente lo vuelve a pedir hasta que llegan los partidos o el error.
 */
@Component
@Slf4j
public class OnDemandCompetitionImport {

    static final Duration RETRY_AFTER = Duration.ofMinutes(10);
    static final int MAX_PER_HOUR = 20;
    private static final Duration WINDOW = Duration.ofHours(1);

    static final String FAILED = "No se han podido cargar los partidos de %s desde ESPN. Vuelve a probar en unos minutos.";
    static final String EMPTY = "ESPN aún no ha publicado partidos de %s. Vuelve a probar más tarde.";
    static final String BUSY = "Se están cargando muchas competiciones a la vez. Vuelve a probar en unos minutos.";

    /** Estado de la carga de una competición: importándose ahora o por qué no tiene partidos. */
    public record Status(boolean importing, String error) {
        public static final Status NONE = new Status(false, null);
        static final Status LOADING = new Status(true, null);
    }

    /** Último intento de una competición: en curso, o cuándo terminó y con qué error. */
    private record Attempt(Instant at, boolean running, String error) {}

    private final Map<Long, Attempt> attempts = new ConcurrentHashMap<>();
    private final Deque<Instant> recentStarts = new ArrayDeque<>();
    private final CompetitionImportService importService;
    private final CacheManager cacheManager;
    private final Executor executor;
    private final Clock clock;

    @Autowired
    public OnDemandCompetitionImport(CompetitionImportService importService, CacheManager cacheManager) {
        // Un hilo (las importaciones comparten el cerrojo de la sincronización) y una cola corta.
        this(importService, cacheManager, new ThreadPoolExecutor(1, 1, 0, TimeUnit.MILLISECONDS,
                new ArrayBlockingQueue<>(8), runnable -> {
                    Thread thread = new Thread(runnable, "on-demand-import");
                    thread.setDaemon(true);
                    return thread;
                }), Clock.systemUTC());
    }

    OnDemandCompetitionImport(CompetitionImportService importService, CacheManager cacheManager, Executor executor,
                              Clock clock) {
        this.importService = importService;
        this.cacheManager = cacheManager;
        this.executor = executor;
        this.clock = clock;
    }

    @PreDestroy
    void shutdown() {
        if (executor instanceof ExecutorService service) service.shutdownNow();
    }

    /**
     * El calendario del asistente con el estado de carga de cada competición: las que no tienen ningún
     * partido se piden a ESPN (si no se han pedido hace poco). La Fórmula 1 no tiene partidos: se queda igual.
     */
    public MatchSelectionDTO withImports(MatchSelectionDTO calendar) {
        Map<Long, Long> matchesByCompetition = calendar.matches().stream()
                .filter(item -> item.competitionId() != null)
                .collect(Collectors.groupingBy(MatchSelectionDTO.Item::competitionId, Collectors.counting()));
        return calendar.withCompetitions(calendar.competitions().stream()
                .map(item -> Sport.ofExternalId(item.externalId()) == Sport.FORMULA_1 ? item
                        : item.withImport(ensureLoaded(item.id(), item.name(),
                                !matchesByCompetition.containsKey(item.id()))))
                .toList());
    }

    /** Estado de la carga de una competición; si no tiene partidos, pide importarla cuando toca. */
    public Status ensureLoaded(Long competitionId, String name, boolean empty) {
        Objects.requireNonNull(competitionId);
        Attempt current = attempts.get(competitionId);
        if (current != null && current.running()) return Status.LOADING;
        if (!empty) return Status.NONE;
        boolean[] start = {false};
        boolean[] busy = {false};
        Instant now = clock.instant();
        Attempt attempt = attempts.compute(competitionId, (id, previous) -> {
            if (previous != null && (previous.running() || previous.at().plus(RETRY_AFTER).isAfter(now))) {
                return previous;
            }
            // Sin hueco no cuenta como intento: se podrá pedir en cuanto lo haya.
            if (!takeSlot(now)) {
                busy[0] = true;
                return previous;
            }
            start[0] = true;
            return new Attempt(now, true, null);
        });
        if (busy[0]) return new Status(false, BUSY);
        if (start[0]) {
            try {
                executor.execute(() -> run(competitionId, name));
            } catch (RejectedExecutionException full) {
                attempts.remove(competitionId);
                return new Status(false, BUSY);
            }
            attempt = attempts.get(competitionId);
        }
        if (attempt == null) return Status.NONE;
        // Un intento que acabó bien sin partidos ya trae su aviso; si acabó bien y hay partidos, nada.
        return attempt.running() ? Status.LOADING : new Status(false, attempt.error());
    }

    private void run(Long competitionId, String name) {
        String error = null;
        try {
            var result = importService.importCompetitionData(competitionId);
            if (result.importedMatches() == 0) {
                error = EMPTY.formatted(name);
            } else {
                // Las listas de competiciones y partidos guardadas en caché aún la tienen vacía.
                for (String cacheName : SeasonCalendarRefresher.CACHES) {
                    var cache = cacheManager.getCache(cacheName);
                    if (cache != null) cache.clear();
                }
            }
            log.info("Carga bajo demanda: {} ({} equipos, {} partidos)", result.competition(),
                    result.importedTeams(), result.importedMatches());
        } catch (Exception failure) {
            log.warn("Carga bajo demanda: no se pudo cargar {}: {}", name, failure.getMessage());
            error = FAILED.formatted(name);
        } finally {
            String finalError = error;
            attempts.computeIfPresent(competitionId,
                    (id, attempt) -> new Attempt(clock.instant(), false, finalError));
        }
    }

    /** Hueco en el límite de importaciones por hora entre todas las competiciones. */
    private boolean takeSlot(Instant now) {
        synchronized (recentStarts) {
            while (!recentStarts.isEmpty() && !recentStarts.peekFirst().plus(WINDOW).isAfter(now)) {
                recentStarts.pollFirst();
            }
            if (recentStarts.size() >= MAX_PER_HOUR) return false;
            recentStarts.addLast(now);
            return true;
        }
    }
}
