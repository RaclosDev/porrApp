package com.porra.mundial.config;

import com.porra.mundial.service.SyncService;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.LocalDateTime;

/**
 * HealthIndicator de Spring Boot Actuator para monitorizar la salud de la sincronizacion deportiva.
 */
@Component
@RequiredArgsConstructor
public class SyncHealthIndicator implements HealthIndicator {

    private final SyncService syncService;

    @Override
    public Health health() {
        LocalDateTime lastSync = syncService.getLastSyncTime();
        if (lastSync == null) {
            return Health.up()
                    .withDetail("syncStatus", "INITIALIZING")
                    .withDetail("message", "Sincronizador en espera del primer ciclo")
                    .build();
        }

        long minutesSinceLastSync = Duration.between(lastSync, LocalDateTime.now()).toMinutes();
        String status = syncService.getLastSyncStatus();

        Health.Builder builder = ("success".equalsIgnoreCase(status) || "INITIALIZING".equalsIgnoreCase(status))
                ? Health.up()
                : Health.down();

        return builder
                .withDetail("lastSyncTime", lastSync.toString())
                .withDetail("minutesSinceLastSync", minutesSinceLastSync)
                .withDetail("status", status)
                .withDetail("matchesUpdated", syncService.getLastMatchesUpdated())
                .withDetail("teamsUpdated", syncService.getLastTeamsUpdated())
                .withDetail("lastError", syncService.getLastErrorMessage() != null ? syncService.getLastErrorMessage() : "None")
                .build();
    }
}
