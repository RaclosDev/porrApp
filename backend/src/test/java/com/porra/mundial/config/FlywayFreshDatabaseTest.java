package com.porra.mundial.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.output.MigrateResult;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Las migraciones tienen que poder montar la base entera desde cero (primer `docker compose up`),
 * no solo aplicarse sobre la de producción. Se salta si no hay Docker disponible.
 */
@Testcontainers(disabledWithoutDocker = true)
class FlywayFreshDatabaseTest {

    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    @Test
    void migratesAnEmptyDatabaseToTheLatestVersion() throws Exception {
        MigrateResult result = Flyway.configure()
                .dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
                .locations("classpath:db/migration")
                .load()
                .migrate();

        assertThat(result.success).isTrue();
        assertThat(result.migrationsExecuted).isPositive();

        try (Connection c = DriverManager.getConnection(
                POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
             ResultSet rs = c.createStatement().executeQuery(
                     "SELECT count(*) FROM teams WHERE id BETWEEN 50 AND 69")) {
            rs.next();
            // V34 referencia esos equipos; V33.1 los crea cuando no existen.
            assertThat(rs.getInt(1)).isEqualTo(20);
        }

        try (Connection c = DriverManager.getConnection(
                POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
             ResultSet rs = c.createStatement().executeQuery(
                     "SELECT c.external_id, count(*) FROM matches m JOIN competitions c ON c.id = m.competition_id"
                             + " WHERE m.round LIKE 'Jornada %' GROUP BY c.external_id")) {
            // Las jornadas que importa V34 tienen que quedar en LaLiga aunque no sea la competición 4.
            assertThat(rs.next()).isTrue();
            assertThat(rs.getString(1)).isEqualTo("esp.1");
            assertThat(rs.getInt(2)).isEqualTo(90);
            assertThat(rs.next()).isFalse();
        }
    }
}
