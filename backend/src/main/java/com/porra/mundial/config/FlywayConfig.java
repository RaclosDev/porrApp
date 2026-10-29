package com.porra.mundial.config;

import lombok.extern.slf4j.Slf4j;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.CoreErrorCode;
import org.flywaydb.core.api.output.ValidateOutput;
import org.springframework.boot.flyway.autoconfigure.FlywayMigrationStrategy;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;
import java.util.Set;

/**
 * Migración con validación estricta y una única excepción documentada.
 *
 * <p>La V38 de producción se aplicó con una versión anterior del script; las diferencias de esquema
 * las corrigen V39 y V40, pero el checksum registrado no coincide con el fichero actual. Si las únicas
 * discrepancias son de checksum en {@link #KNOWN_CHECKSUM_DRIFT}, se actualiza el historial con
 * {@code repair()}. Cualquier otra migración editada o fallida detiene el arranque.
 */
@Configuration
@Slf4j
public class FlywayConfig {

    static final Set<String> KNOWN_CHECKSUM_DRIFT = Set.of("38");

    @Bean
    public FlywayMigrationStrategy flywayMigrationStrategy() {
        return flyway -> {
            if (onlyKnownChecksumDrift(flyway)) {
                log.warn("Checksum de migraciones {} distinto del registrado: se actualiza el historial de Flyway.",
                        KNOWN_CHECKSUM_DRIFT);
                flyway.repair();
            }
            flyway.migrate();
        };
    }

    private static boolean onlyKnownChecksumDrift(Flyway flyway) {
        // Las migraciones pendientes también salen como inválidas aquí; migrate() las aplica después.
        List<ValidateOutput> problems = flyway.validateWithResult().invalidMigrations.stream()
                .filter(m -> m.errorDetails == null
                        || m.errorDetails.errorCode != CoreErrorCode.RESOLVED_VERSIONED_MIGRATION_NOT_APPLIED)
                .toList();
        return !problems.isEmpty() && problems.stream().allMatch(m ->
                m.errorDetails != null
                        && m.errorDetails.errorCode == CoreErrorCode.CHECKSUM_MISMATCH
                        && KNOWN_CHECKSUM_DRIFT.contains(m.version));
    }
}
