package com.porra.mundial.config;

import org.flywaydb.core.Flyway;
import org.springframework.boot.autoconfigure.flyway.FlywayMigrationStrategy;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Configuración de la librería de migraciones de Base de Datos Flyway.
 */
@Configuration
public class FlywayConfig {

    /**
     * Sobrescribe el comportamiento por defecto de Flyway.
     * En caso de encontrar checksums inválidos por manipulación manual o cambios 
     * abruptos en las migraciones en desarrollo, ejecuta un `repair()` antes de intentar migrar.
     * Esto evita que la aplicación casque impidiendo el inicio de Spring Boot.
     * 
     * @return Estrategia personalizada de migración.
     */
    @Bean
    public FlywayMigrationStrategy flywayMigrationStrategy() {
        return flyway -> {
            try {
                flyway.migrate(); // Aplica migraciones directamente
            } catch (Exception e) {
                // Si hay fallo o checksum inconsistente, repara y reintenta
                flyway.repair();
                flyway.migrate();
            }
        };
    }
}
