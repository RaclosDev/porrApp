package app.porrapp.repository;

import app.porrapp.model.League;
import app.porrapp.model.UserAccount;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.jpa.test.autoconfigure.TestEntityManager;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.assertj.core.api.Assertions.assertThat;

/** Búsquedas por administrador contra Postgres real: crear una liga y borrar la cuenta dependen de ellas. */
@DataJpaTest(properties = "spring.flyway.out-of-order=true")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers(disabledWithoutDocker = true)
class LeagueRepositoryTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withTmpFs(java.util.Map.of("/var/lib/postgresql/data", "rw"))
            .withCommand("postgres", "-c", "fsync=off", "-c", "synchronous_commit=off", "-c", "full_page_writes=off");

    @Autowired
    private TestEntityManager em;

    @Autowired
    private LeagueRepository leagueRepository;

    @Test
    void findsTheLeaguesOfAnAdminAndTheOneCreatedWithAKey() {
        UserAccount admin = em.persist(UserAccount.builder().googleEmail("admin@test.com").participantName("Admin").build());
        UserAccount other = em.persist(UserAccount.builder().googleEmail("otro@test.com").participantName("Otro").build());
        League keyed = em.persist(League.builder().name("Con clave").joinCode("AAAA1111").adminUser(admin)
                .creationKey("clave-1").build());
        em.persist(League.builder().name("Sin clave").joinCode("BBBB2222").adminUser(admin).build());
        em.persist(League.builder().name("Ajena").joinCode("CCCC3333").adminUser(other).creationKey("clave-1").build());
        em.flush();

        assertThat(leagueRepository.findByAdminUserIdAndCreationKey(admin.getId(), "clave-1"))
                .map(League::getId).contains(keyed.getId());
        assertThat(leagueRepository.findByAdminUserIdAndCreationKey(admin.getId(), "otra")).isEmpty();
        assertThat(leagueRepository.findByAdminUserId(admin.getId()))
                .extracting(League::getName).containsExactlyInAnyOrder("Con clave", "Sin clave");
    }
}
