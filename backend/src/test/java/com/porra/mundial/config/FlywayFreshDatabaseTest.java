package com.porra.mundial.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;

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
    void rejectsChangedChecksumWithoutRewritingHistory() throws Exception {
        String url = createDatabase("checksum_integrity");
        Flyway flyway = flyway(url);
        flyway.migrate();
        try (Connection c = DriverManager.getConnection(url, POSTGRES.getUsername(), POSTGRES.getPassword());
             Statement st = c.createStatement()) {
            st.execute("UPDATE flyway_schema_history SET checksum = 123 WHERE version = '6'");
        }

        assertThatThrownBy(flyway::migrate)
                .isInstanceOf(org.flywaydb.core.api.exception.FlywayValidateException.class);

        try (Connection c = DriverManager.getConnection(url, POSTGRES.getUsername(), POSTGRES.getPassword());
             Statement st = c.createStatement()) {
            assertThat(queryLong(st, "SELECT checksum FROM flyway_schema_history WHERE version = '6'"))
                    .isEqualTo(123);
        }
    }

    @Test
    void migratesAnEmptyDatabaseToTheLatestVersion() throws Exception {
        String url = createDatabase("fresh");
        MigrateResult result = flyway(url).migrate();

        assertThat(result.success).isTrue();
        assertThat(result.migrationsExecuted).isEqualTo(18);

        try (Connection c = DriverManager.getConnection(url, POSTGRES.getUsername(), POSTGRES.getPassword());
             Statement st = c.createStatement()) {
            assertThat(queryLong(st, "SELECT count(*) FROM competitions")).isEqualTo(13);
            assertThat(queryLong(st, "SELECT id FROM competitions WHERE external_id = 'fifa.world'")).isEqualTo(1);
            assertThat(queryLong(st, "SELECT count(*) FROM matches")).isZero();
        }
    }

    /** Base vacía propia, para no compartir el esquema con el resto de tests de la clase. */
    private static String createDatabase(String name) throws Exception {
        try (Connection c = DriverManager.getConnection(
                POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())) {
            c.createStatement().execute("CREATE DATABASE " + name);
        }
        String url = POSTGRES.getJdbcUrl();
        int query = url.indexOf('?');
        String params = query >= 0 ? url.substring(query) : "";
        String base = query >= 0 ? url.substring(0, query) : url;
        return base.substring(0, base.lastIndexOf('/') + 1) + name + params;
    }

    private static Flyway flyway(String url) {
        return Flyway.configure()
                .dataSource(url, POSTGRES.getUsername(), POSTGRES.getPassword())
                .locations("classpath:db/migration")
                .load();
    }

    private static long queryLong(Statement st, String sql) throws Exception {
        try (ResultSet rs = st.executeQuery(sql)) {
            rs.next();
            return rs.getLong(1);
        }
    }
}
