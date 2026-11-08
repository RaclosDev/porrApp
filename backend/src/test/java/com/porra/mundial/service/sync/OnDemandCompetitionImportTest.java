package com.porra.mundial.service.sync;

import com.porra.mundial.dto.MatchSelectionDTO;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.cache.concurrent.ConcurrentMapCacheManager;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class OnDemandCompetitionImportTest {

    private final CompetitionImportService imports = mock(CompetitionImportService.class);
    private final ConcurrentMapCacheManager caches = new ConcurrentMapCacheManager("competitions", "matches");
    private final List<Runnable> queued = new ArrayList<>();
    private final MutableClock clock = new MutableClock();
    private final OnDemandCompetitionImport onDemand = new OnDemandCompetitionImport(imports, caches,
            queued::add, clock);

    @Test
    @DisplayName("Una competición sin partidos se carga en segundo plano y dice «cargando» hasta que termina")
    void importsEmptyCompetitionInBackground() {
        when(imports.importCompetitionData(1L)).thenReturn(new CompetitionImportService.ImportResult("LaLiga", 20, 380));
        caches.getCache("matches").put("1", "vacío");

        assertThat(onDemand.ensureLoaded(1L, "LaLiga", true)).isEqualTo(new OnDemandCompetitionImport.Status(true, null));
        assertThat(onDemand.ensureLoaded(1L, "LaLiga", true).importing()).isTrue();
        assertThat(queued).hasSize(1);

        runQueued();
        verify(imports, times(1)).importCompetitionData(1L);
        assertThat(caches.getCache("matches").get("1")).isNull();
        assertThat(onDemand.ensureLoaded(1L, "LaLiga", false)).isEqualTo(OnDemandCompetitionImport.Status.NONE);
    }

    @Test
    @DisplayName("Con partidos no pide nada a ESPN")
    void leavesLoadedCompetitionsAlone() {
        assertThat(onDemand.ensureLoaded(1L, "LaLiga", false)).isEqualTo(OnDemandCompetitionImport.Status.NONE);
        assertThat(queued).isEmpty();
        verify(imports, never()).importCompetitionData(1L);
    }

    @Test
    @DisplayName("Si ESPN falla da un error claro y no lo vuelve a pedir hasta pasados unos minutos")
    void failureIsReportedAndRateLimited() {
        when(imports.importCompetitionData(1L)).thenThrow(new IllegalStateException("Circuit breaker abierto"));

        onDemand.ensureLoaded(1L, "LaLiga", true);
        runQueued();
        OnDemandCompetitionImport.Status failed = onDemand.ensureLoaded(1L, "LaLiga", true);
        assertThat(failed.importing()).isFalse();
        assertThat(failed.error()).isEqualTo(OnDemandCompetitionImport.FAILED.formatted("LaLiga"));
        assertThat(queued).isEmpty();

        clock.advance(OnDemandCompetitionImport.RETRY_AFTER.minusSeconds(1));
        assertThat(onDemand.ensureLoaded(1L, "LaLiga", true).error()).isNotNull();
        assertThat(queued).isEmpty();

        clock.advance(Duration.ofSeconds(1));
        assertThat(onDemand.ensureLoaded(1L, "LaLiga", true).importing()).isTrue();
        runQueued();
        verify(imports, times(2)).importCompetitionData(1L);
    }

    @Test
    @DisplayName("Si ESPN aún no tiene partidos lo dice, sin volver a pedirlo en cada vistazo")
    void emptyImportIsReported() {
        when(imports.importCompetitionData(1L)).thenReturn(new CompetitionImportService.ImportResult("Copa", 0, 0));

        onDemand.ensureLoaded(1L, "Copa", true);
        runQueued();

        assertThat(onDemand.ensureLoaded(1L, "Copa", true).error())
                .isEqualTo(OnDemandCompetitionImport.EMPTY.formatted("Copa"));
        assertThat(queued).isEmpty();
        verify(imports, times(1)).importCompetitionData(1L);
    }

    @Test
    @DisplayName("Entre todas las competiciones no se lanzan más de las permitidas por hora")
    void hourlyCapAcrossCompetitions() {
        for (long id = 1; id <= OnDemandCompetitionImport.MAX_PER_HOUR; id++) {
            assertThat(onDemand.ensureLoaded(id, "C" + id, true).importing()).isTrue();
        }
        long next = OnDemandCompetitionImport.MAX_PER_HOUR + 1L;
        assertThat(onDemand.ensureLoaded(next, "Otra", true))
                .isEqualTo(new OnDemandCompetitionImport.Status(false, OnDemandCompetitionImport.BUSY));
        assertThat(queued).hasSize(OnDemandCompetitionImport.MAX_PER_HOUR);

        // Un rechazo por el límite no cuenta como intento: se carga en cuanto hay hueco.
        clock.advance(Duration.ofHours(1));
        assertThat(onDemand.ensureLoaded(next, "Otra", true).importing()).isTrue();
    }

    @Test
    @DisplayName("Con la cola llena avisa y deja pedirlo otra vez")
    void fullQueueIsReported() {
        OnDemandCompetitionImport rejecting = new OnDemandCompetitionImport(imports, caches, task -> {
            throw new RejectedExecutionException("llena");
        }, clock);

        assertThat(rejecting.ensureLoaded(1L, "LaLiga", true).error()).isEqualTo(OnDemandCompetitionImport.BUSY);
        assertThat(rejecting.ensureLoaded(1L, "LaLiga", true).error()).isEqualTo(OnDemandCompetitionImport.BUSY);
    }

    @Test
    @DisplayName("Una sola importación por competición aunque lleguen muchas peticiones a la vez")
    void concurrentRequestsImportOnce() throws Exception {
        CountDownLatch release = new CountDownLatch(1);
        when(imports.importCompetitionData(1L)).thenAnswer(invocation -> {
            release.await(5, TimeUnit.SECONDS);
            return new CompetitionImportService.ImportResult("LaLiga", 20, 380);
        });
        ExecutorService background = Executors.newSingleThreadExecutor();
        ExecutorService callers = Executors.newFixedThreadPool(8);
        OnDemandCompetitionImport concurrent = new OnDemandCompetitionImport(imports, caches, background,
                Clock.systemUTC());
        try {
            CountDownLatch go = new CountDownLatch(1);
            List<Future<OnDemandCompetitionImport.Status>> results = new ArrayList<>();
            for (int i = 0; i < 32; i++) {
                results.add(callers.submit(() -> {
                    go.await();
                    return concurrent.ensureLoaded(1L, "LaLiga", true);
                }));
            }
            go.countDown();
            for (Future<OnDemandCompetitionImport.Status> result : results) {
                assertThat(result.get(5, TimeUnit.SECONDS).importing()).isTrue();
            }
            release.countDown();
            background.shutdown();
            assertThat(background.awaitTermination(5, TimeUnit.SECONDS)).isTrue();
            verify(imports, times(1)).importCompetitionData(1L);
        } finally {
            release.countDown();
            callers.shutdownNow();
            background.shutdownNow();
        }
    }

    @Test
    @DisplayName("El calendario marca solo las competiciones vacías, y nunca la Fórmula 1")
    void calendarCarriesImportState() {
        MatchSelectionDTO calendar = new MatchSelectionDTO("ALL", List.of(), List.of(), List.of(), List.of(),
                List.of(new MatchSelectionDTO.Item(10L, "Jornada 1", null, null, "A", null, null, "B", null, null,
                        null, true, false, false, 0, 1L)),
                0, 0, List.of(1L, 2L, 3L),
                List.of(new MatchSelectionDTO.CompetitionItem(1L, "LaLiga", "esp.1", false, false, null),
                        new MatchSelectionDTO.CompetitionItem(2L, "Premier", "eng.1", false, false, null),
                        new MatchSelectionDTO.CompetitionItem(3L, "Fórmula 1", "f1", false, false, null)));

        MatchSelectionDTO result = onDemand.withImports(calendar);

        assertThat(result.competitions()).extracting(MatchSelectionDTO.CompetitionItem::importing)
                .containsExactly(false, true, false);
        assertThat(result.matches()).isEqualTo(calendar.matches());
        assertThat(queued).hasSize(1);
    }

    private void runQueued() {
        List<Runnable> tasks = List.copyOf(queued);
        queued.clear();
        tasks.forEach(Runnable::run);
    }

    private static final class MutableClock extends Clock {
        private Instant now = Instant.parse("2026-11-08T10:00:00Z");

        void advance(Duration duration) {
            now = now.plus(duration);
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }
}
