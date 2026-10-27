package com.porra.mundial.config;

import com.porra.mundial.service.SyncService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.Status;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SyncHealthIndicatorTest {

    @Mock
    private SyncService syncService;

    private SyncHealthIndicator healthIndicator;

    @BeforeEach
    void setUp() {
        healthIndicator = new SyncHealthIndicator(syncService);
    }

    @Test
    @DisplayName("Estado inicial antes del primer ciclo de sync es UP con estado INITIALIZING")
    void testInitialSyncState() {
        when(syncService.getLastSyncTime()).thenReturn(null);

        Health health = healthIndicator.health();

        assertEquals(Status.UP, health.getStatus());
        assertEquals("INITIALIZING", health.getDetails().get("syncStatus"));
    }

    @Test
    @DisplayName("Sincronizacion exitosa reporta UP con detalles de partidos y equipos")
    void testSuccessfulSync() {
        when(syncService.getLastSyncTime()).thenReturn(LocalDateTime.now().minusMinutes(2));
        when(syncService.getLastSyncStatus()).thenReturn("success");
        when(syncService.getLastMatchesUpdated()).thenReturn(5);
        when(syncService.getLastTeamsUpdated()).thenReturn(0);
        when(syncService.getLastErrorMessage()).thenReturn(null);

        Health health = healthIndicator.health();

        assertEquals(Status.UP, health.getStatus());
        assertEquals(5, health.getDetails().get("matchesUpdated"));
        assertEquals("success", health.getDetails().get("status"));
        assertEquals("None", health.getDetails().get("lastError"));
    }

    @Test
    @DisplayName("Fallo en sincronizacion reporta DOWN con mensaje de error")
    void testFailedSync() {
        when(syncService.getLastSyncTime()).thenReturn(LocalDateTime.now().minusMinutes(10));
        when(syncService.getLastSyncStatus()).thenReturn("error");
        when(syncService.getLastErrorMessage()).thenReturn("Connection timeout");

        Health health = healthIndicator.health();

        assertEquals(Status.DOWN, health.getStatus());
        assertEquals("error", health.getDetails().get("status"));
        assertEquals("Connection timeout", health.getDetails().get("lastError"));
    }
}
