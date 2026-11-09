package app.porrapp.service.sync;

import app.porrapp.model.Competition;
import app.porrapp.model.League;
import app.porrapp.model.Match;
import app.porrapp.model.UserAccount;
import app.porrapp.repository.CompetitionRepository;
import app.porrapp.service.sync.CompetitionSeasonService.Season;
import app.porrapp.sports.SportsDataProvider.SeasonWindow;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.jpa.test.autoconfigure.TestEntityManager;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Import;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Temporadas de una competición contra Postgres real: etiqueta, fila vigente y fila archivada. */
@DataJpaTest(properties = "spring.flyway.out-of-order=true")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers(disabledWithoutDocker = true)
@Import(CompetitionSeasonService.class)
class CompetitionSeasonServiceTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    private static final Season SEASON_26_27 = Season.of(new SeasonWindow("2026-08-14T04:00Z", "2027-06-01T03:59Z"));

    @Autowired private TestEntityManager em;
    @Autowired private CompetitionRepository competitions;
    @Autowired private CompetitionSeasonService seasons;

    private Competition competition(String externalId, Instant archivedAt) {
        return em.persistFlushFind(Competition.builder().name("Liga de prueba").externalId(externalId)
                .archivedAt(archivedAt).build());
    }

    private void match(Competition competition, String date) {
        em.persistAndFlush(Match.builder().competition(competition).matchDate(Instant.parse(date)).build());
    }

    private String seasonOf(Competition competition) {
        em.flush();
        em.clear();
        return competitions.findById(competition.getId()).orElseThrow().getSeason();
    }

    @Test
    @DisplayName("La etiqueta es «2026/27» si la temporada cruza el año y «2026» si cabe en uno")
    void labelsASeasonByItsYears() {
        assertThat(SEASON_26_27.label()).isEqualTo("2026/27");
        assertThat(Season.of(new SeasonWindow("2026-02-21T05:00Z", "2026-12-06T04:59Z")).label()).isEqualTo("2026");
        // El proveedor cierra el año natural en la madrugada del 1 de enero: sigue siendo 2026.
        assertThat(Season.of(new SeasonWindow("2026-01-01T10:00Z", "2027-01-01T04:59Z")).label()).isEqualTo("2026");
        assertThat(Season.ofYear(2026).label()).isEqualTo("2026");
    }

    @Test
    @DisplayName("Un torneo corto que pilla el cambio de año es del año en que cae su mitad")
    void aShortTournamentBelongsToASingleYear() {
        assertThat(Season.of(new SeasonWindow("2026-12-28T00:00Z", "2027-01-12T00:00Z")).label()).isEqualTo("2027");
        assertThat(Season.of(new SeasonWindow("2026-12-10T00:00Z", "2027-01-03T00:00Z")).label()).isEqualTo("2026");
    }

    @Test
    @DisplayName("Sin fechas, con fechas que no se entienden o con una temporada de años no hay temporada")
    void aStrangeSeasonIsNoSeason() {
        assertThat(Season.of(null)).isNull();
        assertThat(Season.of(new SeasonWindow("no es fecha", "2027-01-01T00:00Z"))).isNull();
        assertThat(Season.of(new SeasonWindow("2027-01-01T00:00Z", "2026-01-01T00:00Z"))).isNull();
        assertThat(Season.of(new SeasonWindow("2020-01-01T00:00Z", "2030-01-01T00:00Z"))).isNull();
        // Los playoffs de la NBA importan desde antes; si no dicen cuándo empieza su temporada, no se sabe.
        assertThat(Season.of(new SeasonWindow("2026-04-01T00:00Z", "2027-06-20T00:00Z", null))).isNull();
    }

    @Test
    @DisplayName("La temporada empieza donde dice el proveedor, no donde empieza lo que se importa")
    void theSeasonStartsWhereTheProviderSays() {
        Season playoffs = Season.of(new SeasonWindow("2026-04-01T00:00Z", "2027-06-20T00:00Z", "2026-10-01T07:00Z"));

        assertThat(playoffs.label()).isEqualTo("2026/27");
        assertThat(playoffs.start()).isEqualTo(Instant.parse("2026-10-01T07:00:00Z"));
    }

    @Test
    @DisplayName("Anota la temporada en una fila sin partidos o con partidos de esa temporada")
    void annotatesARowOfThatSeason() {
        Competition empty = competition("test.vacia", null);
        Competition playing = competition("test.en-juego", null);
        // Una ronda previa unos días antes del calendario del proveedor sigue siendo de la temporada.
        match(playing, "2026-08-01T18:00:00Z");
        match(playing, "2027-05-30T18:00:00Z");

        assertThat(seasons.annotate(empty.getId(), SEASON_26_27)).isTrue();
        assertThat(seasons.annotate(playing.getId(), SEASON_26_27)).isTrue();

        assertThat(seasonOf(empty)).isEqualTo("2026/27");
        assertThat(seasonOf(playing)).isEqualTo("2026/27");
    }

    @Test
    @DisplayName("Una fila que guarda partidos de otra temporada se queda sin anotar")
    void leavesARowOfAnotherSeasonUnlabelled() {
        Competition previous = competition("test.anterior", null);
        match(previous, "2026-05-24T18:00:00Z");
        Competition mixed = competition("test.mezcla", null);
        match(mixed, "2026-05-24T18:00:00Z");
        match(mixed, "2026-09-12T18:00:00Z");
        Competition next = competition("test.siguiente", null);
        match(next, "2027-09-12T18:00:00Z");

        for (Competition row : List.of(previous, mixed, next)) {
            assertThat(seasons.annotate(row.getId(), SEASON_26_27)).as(row.getExternalId()).isFalse();
            assertThat(seasonOf(row)).as(row.getExternalId()).isNull();
        }
    }

    @Test
    @DisplayName("No cambia una temporada ya anotada, ni toca una archivada, una personalizada o un dato raro")
    void neverChangesAnAnnotatedSeason() {
        Competition labelled = competition("test.anotada", null);
        assertThat(seasons.annotate(labelled.getId(), SEASON_26_27)).isTrue();
        Competition archived = competition("test.archivada", Instant.parse("2026-07-01T00:00:00Z"));
        UserAccount admin = em.persistFlushFind(UserAccount.builder().googleEmail("temporadas@test.invalid")
                .googleName("Temporadas").participantName("Temporadas").build());
        League league = em.persistFlushFind(League.builder().name("Temporadas").joinCode("TEMPORADA").adminUser(admin).build());
        Competition custom = em.persistFlushFind(Competition.builder().name("Torneo del barrio").ownerLeague(league).build());
        Competition unknown = competition("test.sin-dato", null);

        assertThat(seasons.annotate(labelled.getId(), Season.ofYear(2030))).isFalse();
        assertThat(seasons.annotate(archived.getId(), SEASON_26_27)).isFalse();
        assertThat(seasons.annotate(custom.getId(), SEASON_26_27)).isFalse();
        assertThat(seasons.annotate(unknown.getId(), null)).isFalse();
        assertThat(seasons.annotate(-1L, SEASON_26_27)).isFalse();

        assertThat(seasonOf(labelled)).isEqualTo("2026/27");
        assertThat(seasonOf(archived)).isNull();
        assertThat(seasonOf(custom)).isNull();
        assertThat(seasonOf(unknown)).isNull();
    }

    @Test
    @DisplayName("Por id externo y por nombre solo se encuentra la temporada vigente, no las archivadas")
    void lookupsOnlyFindTheCurrentSeason() {
        Competition old = competition("test.temporadas", Instant.parse("2026-07-01T00:00:00Z"));
        Competition older = competition("test.temporadas", Instant.parse("2025-07-01T00:00:00Z"));
        Competition current = competition("test.temporadas", null);
        Competition onlyArchived = competition("test.solo-archivada", Instant.parse("2026-07-01T00:00:00Z"));

        assertThat(competitions.findByExternalId("test.temporadas")).map(Competition::getId).contains(current.getId());
        assertThat(competitions.findIdByExternalId("test.temporadas")).contains(current.getId());
        assertThat(competitions.findByExternalIdIn(List.of("test.temporadas", "test.solo-archivada")))
                .extracting(Competition::getId).containsExactly(current.getId());
        assertThat(competitions.findByName("Liga de prueba")).map(Competition::getId).contains(current.getId());
        assertThat(competitions.findByExternalId("test.solo-archivada")).isEmpty();
        assertThat(competitions.findIdByExternalId("test.solo-archivada")).isEmpty();
        // A las archivadas se sigue llegando por su id: sus ligas las conservan.
        assertThat(competitions.findAllById(List.of(old.getId(), older.getId(), onlyArchived.getId()))).hasSize(3);
        assertThat(old.isArchived()).isTrue();
        assertThat(current.isArchived()).isFalse();
    }

    @Test
    @DisplayName("No caben dos temporadas vigentes de la misma competición")
    void twoCurrentSeasonsOfACompetitionAreRejected() {
        competition("test.unica", null);

        assertThatThrownBy(() -> competition("test.unica", null))
                .hasMessageContaining("uq_competitions_current_external_id");
    }
}
