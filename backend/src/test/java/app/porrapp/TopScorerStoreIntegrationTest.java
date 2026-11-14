package app.porrapp;

import app.porrapp.config.DataInitializer;
import app.porrapp.dto.TopScorerDTO;
import app.porrapp.model.Competition;
import app.porrapp.repository.CompetitionRepository;
import app.porrapp.repository.TopScorerRepository;
import app.porrapp.service.sync.SyncService;
import app.porrapp.service.tournament.TopScorerService;
import app.porrapp.service.tournament.TopScorerStore;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Goleadores guardados por competición, con Postgres real y la migración aplicada. */
@SpringBootTest
@TestPropertySource(locations = "file:src/main/resources/application.properties",
        properties = "app.jwt.secret=top-scorer-store-test-secret-0123456789-abcdefghij")
@Testcontainers(disabledWithoutDocker = true)
class TopScorerStoreIntegrationTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withTmpFs(java.util.Map.of("/var/lib/postgresql/data", "rw"))
            .withCommand("postgres", "-c", "fsync=off", "-c", "synchronous_commit=off", "-c", "full_page_writes=off");

    @MockitoBean private DataInitializer dataInitializer;
    @MockitoBean private TopScorerService topScorerService;
    @MockitoBean private SyncService syncService;

    @Autowired private TopScorerStore store;
    @Autowired private TopScorerRepository rows;
    @Autowired private CompetitionRepository competitions;

    @Test
    @DisplayName("La lista se guarda en su orden, se sustituye entera y cada competición tiene la suya")
    void replacesTheStoredListOfOneCompetition() {
        String cup = "ts-cup." + UUID.randomUUID();
        String league = "ts-league." + UUID.randomUUID();
        Competition cupCompetition = competitions.save(Competition.builder().name("Copa " + cup).externalId(cup).build());
        competitions.save(Competition.builder().name("Liga " + league).externalId(league).build());

        TopScorerDTO mbappe = new TopScorerDTO("Kylian Mbappé", "K. Mbappé", 8, "F", "231388", "Francia", "https://img/m.png");
        TopScorerDTO kane = new TopScorerDTO("Harry Kane", "H. Kane", 6, "F", "155651", "Inglaterra", "");
        // Empatados a goles: se conserva el orden en que llegan.
        TopScorerDTO messi = new TopScorerDTO("Lionel Messi", "L. Messi", 6, "F", "45843", "Argentina", "");
        TopScorerDTO pichichi = new TopScorerDTO("Otro Delantero", "O. Delantero", 20, "F", "9", "Club", "");

        store.replace(cup, List.of(mbappe, kane, messi));
        store.replace(league, List.of(pichichi));

        assertThat(store.load(cup)).containsExactly(mbappe, kane, messi);
        assertThat(store.load(league)).containsExactly(pichichi);

        // Una lista nueva reutiliza los puestos de la anterior sin chocar con ella.
        TopScorerDTO mbappeNine = new TopScorerDTO("Kylian Mbappé", "K. Mbappé", 9, "F", "231388", "Francia", "https://img/m.png");
        store.replace(cup, List.of(mbappeNine, messi));

        assertThat(store.load(cup)).containsExactly(mbappeNine, messi);
        assertThat(store.load(league)).containsExactly(pichichi);
        assertThat(rows.findByCompetitionIdOrderByPositionAsc(cupCompetition.getId())).hasSize(2);
    }

    @Test
    @DisplayName("Sin competición o sin goleadores guardados la lista está vacía, y una foto imposible se guarda sin foto")
    void emptyAndOversizedValues() {
        assertThat(store.load("ts-missing." + UUID.randomUUID())).isEmpty();
        store.replace("ts-missing." + UUID.randomUUID(), List.of(new TopScorerDTO("Nadie", "N.", 1, "", "", "", "")));

        String externalId = "ts-long." + UUID.randomUUID();
        competitions.save(Competition.builder().name("Larga " + externalId).externalId(externalId).build());
        assertThat(store.load(externalId)).isEmpty();

        store.replace(externalId, List.of(new TopScorerDTO("Jugador", "J.", 1, null, null, null, "x".repeat(3000))));

        assertThat(store.load(externalId)).containsExactly(new TopScorerDTO("Jugador", "J.", 1, "", "", "", ""));
    }
}
