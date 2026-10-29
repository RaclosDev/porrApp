package com.porra.mundial.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * V45 deja un único cuadro oficial (el de la cuenta interna Admin) sin borrar filas y
 * después impide marcar un segundo. Se salta si no hay Docker disponible.
 */
@Testcontainers(disabledWithoutDocker = true)
class SingleOfficialPredictionMigrationTest {

    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    private Flyway flyway(String target) {
        return Flyway.configure()
                .dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
                .locations("classpath:db/migration")
                .outOfOrder(true)
                .target(target)
                .load();
    }

    private Connection connect() throws SQLException {
        return DriverManager.getConnection(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
    }

    @Test
    void keepsTheSystemAdminOfficialAndUnmarksTheRest() throws Exception {
        flyway("43").migrate();

        try (Connection c = connect(); Statement st = c.createStatement()) {
            st.execute("INSERT INTO app_users (id, google_email, google_name, participant_name) VALUES"
                    + " (9001, 'a@test.com', 'A', 'A'), (9002, 'admin@local', 'Admin', 'Admin'), (9003, 'b@test.com', 'B', 'B')");
            st.execute("INSERT INTO leagues (id, name, join_code, admin_user_id) VALUES (9001, 'Liga', 'V45TEST', 9001)");
            st.execute("INSERT INTO competitions (name) VALUES ('V45 test')");
            st.execute("INSERT INTO editions (league_id, competition_id, pool_format, status)"
                    + " SELECT 9001, id, 'FULL_BRACKET', 'ACTIVE' FROM competitions WHERE name = 'V45 test'");
            // El más antiguo es de un usuario normal: gana igualmente el de la cuenta Admin.
            st.execute("INSERT INTO predictions (id, user_id, edition_id, prediction_name, is_official, payment_status)"
                    + " SELECT v.id, v.user_id, e.id, v.name, TRUE, 'PENDING'"
                    + " FROM (VALUES (9101, 9001, 'official'), (9102, 9002, 'Cuadro'), (9103, 9003, 'official'))"
                    + " AS v(id, user_id, name), editions e WHERE e.league_id = 9001");
        }

        flyway("45").migrate();

        try (Connection c = connect(); Statement st = c.createStatement()) {
            List<Long> official = new ArrayList<>();
            try (ResultSet rs = st.executeQuery("SELECT id FROM predictions WHERE is_official ORDER BY id")) {
                while (rs.next()) official.add(rs.getLong(1));
            }
            assertThat(official).containsExactly(9102L);

            try (ResultSet rs = st.executeQuery("SELECT count(*) FROM predictions WHERE id IN (9101, 9102, 9103)")) {
                rs.next();
                assertThat(rs.getInt(1)).isEqualTo(3);
            }

            assertThatThrownBy(() -> st.execute("UPDATE predictions SET is_official = TRUE WHERE id = 9101"))
                    .isInstanceOf(SQLException.class)
                    .hasMessageContaining("uq_predictions_single_official");
        }
    }
}
