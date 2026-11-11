package app.porrapp.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationInfo;
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
    void upgradesDeployedScoreboardSchemaWithPushDeliveryAndPermissions() throws Exception {
        String url = createDatabase("push_upgrade");
        Flyway.configure().dataSource(url, POSTGRES.getUsername(), POSTGRES.getPassword())
                .locations("classpath:db/migration").target("57").load().migrate();

        assertThat(flyway(url).migrate().migrationsExecuted).isEqualTo(4);

        try (Connection c = DriverManager.getConnection(url, POSTGRES.getUsername(), POSTGRES.getPassword());
             Statement st = c.createStatement()) {
            assertThat(queryLong(st, "SELECT count(*) FROM push_delivery_retries WHERE receipt_token IS NOT NULL")).isZero();
            assertThat(queryLong(st, "SELECT count(*) FROM push_device_states")).isZero();
            assertThat(queryLong(st, "SELECT count(*) FROM organized_tournaments")).isZero();
            assertThat(queryLong(st, "SELECT count(*) FROM tournament_result_changes")).isZero();
            assertThat(queryLong(st, "SELECT count(*) FROM push_subscriptions WHERE receipts_enabled")).isZero();
        }
    }

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
        Flyway flyway = flyway(url);
        // Todas las migraciones del repositorio, sin fijar cuántas son: añadir una no rompe el test.
        MigrationInfo[] all = flyway.info().pending();
        MigrateResult result = flyway.migrate();

        assertThat(all).isNotEmpty();
        assertThat(result.success).isTrue();
        assertThat(result.migrationsExecuted).isEqualTo(all.length);
        assertThat(result.targetSchemaVersion).isEqualTo(all[all.length - 1].getVersion().getVersion());
        assertThat(flyway.info().pending()).isEmpty();

        try (Connection c = DriverManager.getConnection(url, POSTGRES.getUsername(), POSTGRES.getPassword());
             Statement st = c.createStatement()) {
            // Cada deporte nuevo añade sus competiciones oficiales: aquí se comprueba que estén las de partida.
            assertThat(queryLong(st, "SELECT count(*) FROM competitions")).isGreaterThanOrEqualTo(15);
            assertThat(queryLong(st, "SELECT count(*) FROM competitions WHERE external_id = 'nfl' AND format_type = 'LEAGUE'")).isEqualTo(1);
            assertThat(queryLong(st, "SELECT count(*) FROM competitions WHERE external_id = 'f1' AND format_type = 'RACE'"))
                    .isEqualTo(1);
            assertThat(queryLong(st, "SELECT id FROM competitions WHERE external_id = 'fifa.world'")).isEqualTo(1);
            assertThat(queryLong(st, "SELECT count(*) FROM matches")).isZero();
        }
    }

    @Test
    void scoreboardMigrationTurnsExistingTrackersIntoScoreboardLeagues() throws Exception {
        String url = createDatabase("scoreboard_leagues");
        Flyway.configure().dataSource(url, POSTGRES.getUsername(), POSTGRES.getPassword())
                .locations("classpath:db/migration").target("48").load().migrate();
        try (Connection c = DriverManager.getConnection(url, POSTGRES.getUsername(), POSTGRES.getPassword());
             Statement st = c.createStatement()) {
            st.execute("INSERT INTO app_users (id, google_email, participant_name) VALUES (1, 'a@x.com', 'Ana'), (2, 'b@x.com', 'Berto')");
            st.execute("INSERT INTO score_trackers (id, owner_user_id, name, unit, lower_wins, join_code) VALUES (7, 1, 'Mus', 'bazas', true, 'ABCDEFGH')");
            st.execute("INSERT INTO score_tracker_members (tracker_id, user_id) VALUES (7, 2)");
            st.execute("INSERT INTO score_tracker_players (id, tracker_id, name, position, user_id) VALUES (70, 7, 'Ana', 0, 1), (71, 7, 'Berto', 1, 2)");
            st.execute("INSERT INTO score_tracker_sessions (id, tracker_id) VALUES (80, 7)");
            st.execute("INSERT INTO score_tracker_rounds (id, tracker_id, session_id) VALUES (90, 7, 80)");
            st.execute("INSERT INTO score_tracker_scores (round_id, player_id, points) VALUES (90, 70, 3), (90, 71, 1)");
        }

        flyway(url).migrate();

        try (Connection c = DriverManager.getConnection(url, POSTGRES.getUsername(), POSTGRES.getPassword());
             Statement st = c.createStatement()) {
            assertThat(queryLong(st, "SELECT count(*) FROM leagues WHERE kind = 'SCOREBOARD' AND join_code = 'ABCDEFGH' AND admin_user_id = 1")).isEqualTo(1);
            assertThat(queryLong(st, "SELECT count(*) FROM memberships m JOIN leagues l ON l.id = m.league_id WHERE l.join_code = 'ABCDEFGH'")).isEqualTo(2);
            assertThat(queryLong(st, "SELECT count(*) FROM memberships m JOIN leagues l ON l.id = m.league_id WHERE l.join_code = 'ABCDEFGH' AND m.user_id = 1 AND m.role = 'ADMIN'")).isEqualTo(1);
            assertThat(queryLong(st, "SELECT count(*) FROM score_games g JOIN leagues l ON l.id = g.league_id WHERE l.join_code = 'ABCDEFGH' AND g.name = 'Mus' AND g.unit = 'bazas' AND g.lower_wins")).isEqualTo(1);
            assertThat(queryLong(st, "SELECT count(*) FROM score_tracker_players p JOIN leagues l ON l.id = p.league_id WHERE l.join_code = 'ABCDEFGH'")).isEqualTo(2);
            assertThat(queryLong(st, "SELECT count(*) FROM score_tracker_sessions s JOIN score_games g ON g.id = s.game_id AND g.league_id = s.league_id WHERE s.id = 80")).isEqualTo(1);
            assertThat(queryLong(st, "SELECT count(*) FROM score_tracker_rounds r JOIN leagues l ON l.id = r.league_id WHERE r.id = 90 AND l.kind = 'SCOREBOARD'")).isEqualTo(1);
            assertThat(queryLong(st, "SELECT count(*) FROM score_tracker_scores")).isEqualTo(2);
            assertThat(queryLong(st, "SELECT count(*) FROM leagues WHERE kind = 'POOL'")).isZero();
            // Borrar la liga se lleva jugadores, juegos, sesiones y partidas.
            st.execute("DELETE FROM memberships WHERE league_id IN (SELECT id FROM leagues WHERE join_code = 'ABCDEFGH')");
            st.execute("DELETE FROM leagues WHERE join_code = 'ABCDEFGH'");
            assertThat(queryLong(st, "SELECT count(*) FROM score_tracker_players")).isZero();
            assertThat(queryLong(st, "SELECT count(*) FROM score_games")).isZero();
            assertThat(queryLong(st, "SELECT count(*) FROM score_tracker_scores")).isZero();
        }
    }

    @Test
    void daysMigrationTurnsEachOldSessionIntoADayWithEveryoneAndOnlyTheLastOneOpen() throws Exception {
        String url = createDatabase("score_days");
        Flyway.configure().dataSource(url, POSTGRES.getUsername(), POSTGRES.getPassword())
                .locations("classpath:db/migration").target("48").load().migrate();
        try (Connection c = DriverManager.getConnection(url, POSTGRES.getUsername(), POSTGRES.getPassword());
             Statement st = c.createStatement()) {
            st.execute("INSERT INTO app_users (id, google_email, participant_name) VALUES (1, 'a@x.com', 'Ana')");
            st.execute("INSERT INTO score_trackers (id, owner_user_id, name, unit, lower_wins, join_code) VALUES (7, 1, 'Mus', 'bazas', false, 'ABCDEFGH')");
            st.execute("INSERT INTO score_tracker_players (id, tracker_id, name, position, user_id) VALUES (70, 7, 'Ana', 0, 1), (71, 7, 'Berto', 1, NULL)");
            st.execute("INSERT INTO score_tracker_sessions (id, tracker_id, started_at) VALUES (80, 7, now() - interval '3 days'), (81, 7, now())");
            st.execute("INSERT INTO score_tracker_rounds (id, tracker_id, session_id, created_at) VALUES (90, 7, 80, now() - interval '2 days'), (91, 7, 81, now())");
            st.execute("INSERT INTO score_tracker_scores (round_id, player_id, points) VALUES (90, 70, 3), (90, 71, 1), (91, 70, 2)");
        }

        flyway(url).migrate();

        try (Connection c = DriverManager.getConnection(url, POSTGRES.getUsername(), POSTGRES.getPassword());
             Statement st = c.createStatement()) {
            assertThat(queryLong(st, "SELECT count(*) FROM score_games WHERE mode = 'POINTS'")).isEqualTo(1);
            assertThat(queryLong(st, "SELECT count(*) FROM score_games WHERE target_wins IS NULL")).isEqualTo(1);
            assertThatThrownBy(() -> st.execute("UPDATE score_games SET target_wins = 5"))
                    .isInstanceOf(java.sql.SQLException.class).hasMessageContaining("score_games_target_wins_check");
            st.execute("UPDATE score_games SET mode = 'ROUNDS', target_wins = 5");
            assertThat(queryLong(st, "SELECT target_wins FROM score_games")).isEqualTo(5);
            assertThatThrownBy(() -> st.execute("UPDATE score_games SET target_wins = 0"))
                    .isInstanceOf(java.sql.SQLException.class).hasMessageContaining("score_games_target_wins_check");
            assertThat(queryLong(st, "SELECT count(*) FROM score_days")).isEqualTo(2);
            assertThat(queryLong(st, "SELECT count(DISTINCT day_id) FROM score_tracker_sessions")).isEqualTo(2);
            assertThat(queryLong(st, "SELECT count(*) FROM score_day_players")).isEqualTo(4);
            assertThat(queryLong(st, "SELECT count(*) FROM score_session_players")).isEqualTo(4);
            assertThat(queryLong(st, "SELECT count(*) FROM score_tracker_sessions WHERE id = 80 AND ended_at IS NOT NULL")).isEqualTo(1);
            assertThat(queryLong(st, "SELECT count(*) FROM score_tracker_sessions WHERE id = 81 AND ended_at IS NULL")).isEqualTo(1);
            assertThat(queryLong(st, "SELECT count(*) FROM score_days d JOIN score_tracker_sessions s ON s.day_id = d.id WHERE s.id = 80 AND d.closed_at IS NOT NULL")).isEqualTo(1);
            assertThat(queryLong(st, "SELECT count(*) FROM score_days d JOIN score_tracker_sessions s ON s.day_id = d.id WHERE s.id = 81 AND d.closed_at IS NULL")).isEqualTo(1);
            assertThat(queryLong(st, "SELECT count(*) FROM score_tracker_rounds WHERE created_by_user_id IS NULL")).isEqualTo(2);
            // Borrar la liga se lleva también los días y sus asistentes.
            st.execute("DELETE FROM memberships WHERE league_id IN (SELECT id FROM leagues WHERE join_code = 'ABCDEFGH')");
            st.execute("DELETE FROM leagues WHERE join_code = 'ABCDEFGH'");
            assertThat(queryLong(st, "SELECT count(*) FROM score_days")).isZero();
            assertThat(queryLong(st, "SELECT count(*) FROM score_day_players")).isZero();
            assertThat(queryLong(st, "SELECT count(*) FROM score_session_players")).isZero();
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
