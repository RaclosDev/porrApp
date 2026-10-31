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
    void rejectsChangedV38ChecksumWithoutRewritingHistory() throws Exception {
        String url = createDatabase("checksum_integrity");
        Flyway flyway = flyway(url, null);
        flyway.migrate();
        try (Connection c = DriverManager.getConnection(url, POSTGRES.getUsername(), POSTGRES.getPassword());
             Statement st = c.createStatement()) {
            st.execute("UPDATE flyway_schema_history SET checksum = 123 WHERE version = '38'");
        }

        assertThatThrownBy(flyway::migrate)
                .isInstanceOf(org.flywaydb.core.api.exception.FlywayValidateException.class);

        try (Connection c = DriverManager.getConnection(url, POSTGRES.getUsername(), POSTGRES.getPassword());
             Statement st = c.createStatement()) {
            assertThat(queryLong(st, "SELECT checksum FROM flyway_schema_history WHERE version = '38'"))
                    .isEqualTo(123);
        }
    }

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

    @Test
    void v50RepairsOnlyMissingWorldCupBracketDeadlines() throws Exception {
        String url = createDatabase("v50_deadlines");
        flyway(url, "49").migrate();
        try (Connection c = DriverManager.getConnection(url, POSTGRES.getUsername(), POSTGRES.getPassword());
             Statement st = c.createStatement()) {
            st.execute("INSERT INTO app_users (id, google_email, google_name, participant_name) VALUES"
                    + " (9501, 'deadline@test.com', 'Deadline', 'Deadline')");
            st.execute("INSERT INTO leagues (id, name, join_code, admin_user_id) VALUES"
                    + " (9501, 'Deadline', 'DEADLINE', 9501)");
            st.execute("INSERT INTO editions (id, league_id, competition_id, pool_format, lock_date)"
                    + " OVERRIDING SYSTEM VALUE SELECT 9501, 9501, id, 'FULL_BRACKET', NULL"
                    + " FROM competitions WHERE external_id = 'fifa.world'");
            st.execute("INSERT INTO editions (id, league_id, competition_id, pool_format, lock_date)"
                    + " OVERRIDING SYSTEM VALUE SELECT 9502, 9501, id, 'KNOCKOUTS_ONLY', NULL"
                    + " FROM competitions WHERE external_id = 'fifa.world'");
            st.execute("INSERT INTO editions (id, league_id, competition_id, pool_format, lock_date)"
                    + " OVERRIDING SYSTEM VALUE SELECT 9503, 9501, id, 'MATCH_DAY', NULL"
                    + " FROM competitions WHERE external_id = 'fifa.world'");
            st.execute("INSERT INTO editions (id, league_id, competition_id, pool_format, lock_date)"
                    + " OVERRIDING SYSTEM VALUE SELECT 9504, 9501, id, 'FULL_BRACKET', TIMESTAMP '2026-06-10 12:00:00'"
                    + " FROM competitions WHERE external_id = 'fifa.world'");
            st.execute("INSERT INTO editions (id, league_id, competition_id, pool_format, lock_date)"
                    + " OVERRIDING SYSTEM VALUE SELECT 9505, 9501, id, 'MATCH_DAY', NULL"
                    + " FROM competitions WHERE external_id = 'esp.1'");
        }

        flyway(url, null).migrate();

        try (Connection c = DriverManager.getConnection(url, POSTGRES.getUsername(), POSTGRES.getPassword());
             Statement st = c.createStatement()) {
            assertThat(queryLong(st, "SELECT count(*) FROM editions WHERE id IN (9501,9502)"
                    + " AND lock_date = TIMESTAMP '2026-06-11 20:00:00'")).isEqualTo(2);
            assertThat(queryLong(st, "SELECT count(*) FROM editions WHERE id IN (9503,9505) AND lock_date IS NULL"))
                    .isEqualTo(2);
            assertThat(queryLong(st, "SELECT count(*) FROM editions WHERE id = 9504"
                    + " AND lock_date = TIMESTAMP '2026-06-10 12:00:00'")).isEqualTo(1);
        }
    }

    @Test
    void v46LeavesOneIndexPerLookup() throws Exception {
        String url = createDatabase("v46_indexes");
        flyway(url, null).migrate();

        try (Connection c = DriverManager.getConnection(url, POSTGRES.getUsername(), POSTGRES.getPassword());
             Statement st = c.createStatement();
             ResultSet rs = st.executeQuery("SELECT indexname FROM pg_indexes"
                     + " WHERE tablename IN ('pronosticos_partido', 'app_users') ORDER BY indexname")) {
            java.util.List<String> indexes = new java.util.ArrayList<>();
            while (rs.next()) indexes.add(rs.getString(1));

            assertThat(indexes).containsExactly(
                    "app_users_google_email_key", "app_users_google_sub_key", "app_users_pkey",
                    "idx_pronosticos_partido_match", "pronosticos_partido_pkey", "uq_prediction_match");
        }
    }

    @Test
    void v48AddsAUniqueGoogleSubAndRefreshTokensThatFollowTheirUser() throws Exception {
        String url = createDatabase("v48_sessions");
        flyway(url, "47").migrate();
        try (Connection c = DriverManager.getConnection(url, POSTGRES.getUsername(), POSTGRES.getPassword());
             Statement st = c.createStatement()) {
            st.execute("INSERT INTO app_users (id, google_email, google_name, participant_name) OVERRIDING SYSTEM VALUE VALUES"
                    + " (9401, 'ana@test.com', 'Ana', 'Ana'), (9402, 'luis@test.com', 'Luis', 'Luis')");
        }

        flyway(url, null).migrate();

        try (Connection c = DriverManager.getConnection(url, POSTGRES.getUsername(), POSTGRES.getPassword());
             Statement st = c.createStatement()) {
            // Las cuentas que ya existían quedan sin sub hasta que vuelven a entrar.
            assertThat(queryLong(st, "SELECT count(*) FROM app_users WHERE google_sub IS NULL AND id IN (9401, 9402)"))
                    .isEqualTo(2);
            st.execute("UPDATE app_users SET google_sub = 'sub-ana' WHERE id = 9401");
            try {
                st.execute("UPDATE app_users SET google_sub = 'sub-ana' WHERE id = 9402");
                org.junit.jupiter.api.Assertions.fail("google_sub tiene que ser único");
            } catch (java.sql.SQLException e) {
                assertThat(e.getSQLState()).isEqualTo("23505");
            }

            st.execute("INSERT INTO refresh_token_families (id, user_id, expires_at) OVERRIDING SYSTEM VALUE"
                    + " VALUES (9401, 9401, now() + interval '30 days')");
            st.execute("INSERT INTO refresh_tokens (family_id, token_hash) VALUES (9401, repeat('a', 64))");
            st.execute("DELETE FROM app_users WHERE id = 9401");
            assertThat(queryLong(st, "SELECT count(*) FROM refresh_tokens WHERE family_id = 9401")).isZero();
        }
    }

    @Test
    void v47DropsTheOfficialPredictionAndItsFlag() throws Exception {
        String url = createDatabase("v47_official");
        flyway(url, "46").migrate();
        try (Connection c = DriverManager.getConnection(url, POSTGRES.getUsername(), POSTGRES.getPassword());
             Statement st = c.createStatement()) {
            st.execute("INSERT INTO app_users (id, google_email, google_name, participant_name) OVERRIDING SYSTEM VALUE VALUES"
                    + " (9201, 'admin@local', 'Admin', 'Admin'), (9202, 'ana@test.com', 'Ana', 'Ana')");
            st.execute("INSERT INTO leagues (id, name, join_code, admin_user_id) OVERRIDING SYSTEM VALUE VALUES (9201, 'Liga', 'OFIC47', 9201)");
            st.execute("INSERT INTO editions (id, league_id, competition_id, pool_format, status) OVERRIDING SYSTEM VALUE VALUES"
                    + " (9201, 9201, (SELECT id FROM competitions WHERE external_id = 'fifa.world'), 'FULL_BRACKET', 'ACTIVE')");
            st.execute("INSERT INTO predictions (id, user_id, edition_id, prediction_name, is_official, payment_status, created_at)"
                    + " OVERRIDING SYSTEM VALUE VALUES (9301, 9201, 9201, 'Cuadro oficial', TRUE, 'PAID', now()),"
                    + " (9302, 9202, 9201, 'Ana', FALSE, 'PAID', now())");
        }

        flyway(url, null).migrate();

        try (Connection c = DriverManager.getConnection(url, POSTGRES.getUsername(), POSTGRES.getPassword());
             Statement st = c.createStatement()) {
            assertThat(queryLong(st, "SELECT count(*) FROM predictions WHERE id = 9301")).isZero();
            assertThat(queryLong(st, "SELECT count(*) FROM predictions WHERE id = 9302")).isEqualTo(1);
            assertThat(queryLong(st, "SELECT count(*) FROM information_schema.columns"
                    + " WHERE table_name = 'predictions' AND column_name = 'is_official'")).isZero();
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

    private static Flyway flyway(String url, String target) {
        var config = Flyway.configure()
                .dataSource(url, POSTGRES.getUsername(), POSTGRES.getPassword())
                .locations("classpath:db/migration")
                .outOfOrder(true);
        return (target != null ? config.target(target) : config).load();
    }

    private static long queryLong(Statement st, String sql) throws Exception {
        try (ResultSet rs = st.executeQuery(sql)) {
            rs.next();
            return rs.getLong(1);
        }
    }

    @Test
    void v44MergesDuplicatedMatchesWithoutLosingPredictions() throws Exception {
        String url = createDatabase("v44_duplicates");
        flyway(url, "43").migrate();

        try (Connection c = DriverManager.getConnection(url, POSTGRES.getUsername(), POSTGRES.getPassword());
             Statement st = c.createStatement()) {
            st.execute("INSERT INTO app_users (id, google_email, google_name, participant_name) OVERRIDING SYSTEM VALUE VALUES"
                    + " (9001, 'ana@test.com', 'Ana', 'Ana'), (9002, 'luis@test.com', 'Luis', 'Luis')");
            st.execute("INSERT INTO leagues (id, name, join_code, admin_user_id) OVERRIDING SYSTEM VALUE VALUES (9001, 'Liga', 'DUPL44', 9001)");
            st.execute("INSERT INTO editions (id, league_id, competition_id, pool_format, status) OVERRIDING SYSTEM VALUE VALUES"
                    + " (9001, 9001, (SELECT id FROM competitions WHERE external_id = 'fifa.world'), 'MATCH_DAY', 'ACTIVE')");
            st.execute("INSERT INTO predictions (id, user_id, edition_id, prediction_name, score_calculated_at) OVERRIDING SYSTEM VALUE VALUES"
                    + " (9001, 9001, 9001, 'Porra Ana', now()), (9002, 9002, 9001, 'Porra Luis', now())");
            // Copia vieja sin terminar y copia terminada del mismo partido de ESPN, más un partido sin repetir.
            st.execute("INSERT INTO matches (id, external_id, finished, home_score, away_score) OVERRIDING SYSTEM VALUE VALUES"
                    + " (9001, 'dup-1', false, null, null), (9002, 'dup-1', true, 2, 1), (9003, 'solo-1', false, null, null),"
                    + " (9004, '', false, null, null), (9005, '', false, null, null)");
            // Ana pronosticó en las dos copias (gana el último guardado); Luis solo en la que se borra.
            st.execute("INSERT INTO pronosticos_partido (id, prediction_id, match_id, home_score, away_score, updated_at) OVERRIDING SYSTEM VALUE VALUES"
                    + " (9001, 9001, 9001, 1, 0, '2026-06-10 10:00'), (9002, 9001, 9002, 3, 3, '2026-06-09 10:00'),"
                    + " (9003, 9002, 9001, 2, 1, '2026-06-09 10:00')");
        }

        flyway(url, null).migrate();

        try (Connection c = DriverManager.getConnection(url, POSTGRES.getUsername(), POSTGRES.getPassword());
             Statement st = c.createStatement()) {
            assertThat(queryLong(st, "SELECT count(*) FROM matches WHERE external_id = 'dup-1'")).isEqualTo(1);
            assertThat(queryLong(st, "SELECT id FROM matches WHERE external_id = 'dup-1'")).isEqualTo(9002);
            assertThat(queryLong(st, "SELECT count(*) FROM matches WHERE id IN (9003, 9004, 9005)")).isEqualTo(3);
            assertThat(queryLong(st, "SELECT count(*) FROM pronosticos_partido WHERE id >= 9001")).isEqualTo(2);
            assertThat(queryLong(st, "SELECT home_score FROM pronosticos_partido WHERE prediction_id = 9001")).isEqualTo(1);
            assertThat(queryLong(st, "SELECT match_id FROM pronosticos_partido WHERE prediction_id = 9001")).isEqualTo(9002);
            assertThat(queryLong(st, "SELECT match_id FROM pronosticos_partido WHERE prediction_id = 9002")).isEqualTo(9002);
            assertThat(queryLong(st, "SELECT count(*) FROM predictions WHERE id IN (9001, 9002)"
                    + " AND score_calculated_at IS NULL")).isEqualTo(2);

            try {
                st.execute("INSERT INTO matches (external_id) VALUES ('dup-1')");
                org.junit.jupiter.api.Assertions.fail("external_id tiene que ser único");
            } catch (java.sql.SQLException e) {
                assertThat(e.getSQLState()).isEqualTo("23505");
            }
        }
    }
}
