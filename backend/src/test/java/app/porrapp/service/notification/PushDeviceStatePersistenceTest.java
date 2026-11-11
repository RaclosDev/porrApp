package app.porrapp.service.notification;

import app.porrapp.dto.PushDeviceStateRequest;
import app.porrapp.model.UserAccount;
import app.porrapp.repository.PushDeviceStateRepository;
import app.porrapp.repository.UserAccountRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Import;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import jakarta.persistence.EntityManager;
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers(disabledWithoutDocker = true)
@Import(PushDeviceStateService.class)
class PushDeviceStatePersistenceTest {
    @Container @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");
    @Autowired private PushDeviceStateService service;
    @Autowired private PushDeviceStateRepository states;
    @Autowired private UserAccountRepository users;
    @Autowired private EntityManager entityManager;

    @Test
    void updatesTheSameDevicePreservesThePromptAndSeparatesAccounts() {
        var first = users.saveAndFlush(UserAccount.builder().googleEmail("first@test.invalid").participantName("First").build());
        var second = users.saveAndFlush(UserAccount.builder().googleEmail("second@test.invalid").participantName("Second").build());
        UUID device = UUID.randomUUID();
        service.observe(first.getGoogleEmail(), new PushDeviceStateRequest(device, "denied", false, true));
        var promptAt = states.findAll().getFirst().getLastPromptAt();
        assertThat(promptAt).isNotNull();
        service.observe(first.getGoogleEmail(), new PushDeviceStateRequest(device, "granted", false, false));
        service.observe(second.getGoogleEmail(), new PushDeviceStateRequest(device, "unsupported", true, false));
        entityManager.clear();
        assertThat(states.findAll()).hasSize(2).anySatisfy(state -> {
            assertThat(state.getUserId()).isEqualTo(first.getId());
            assertThat(state.getPermission()).isEqualTo("granted");
            assertThat(state.getLastPromptAt()).isEqualTo(promptAt);
            assertThat(state.getObservedAt()).isAfterOrEqualTo(promptAt);
        }).anySatisfy(state -> {
            assertThat(state.getUserId()).isEqualTo(second.getId());
            assertThat(state.isInstallRequired()).isTrue();
            assertThat(state.getLastPromptAt()).isNull();
        });
        users.deleteById(first.getId());
        users.flush();
        assertThat(states.findAll()).singleElement().satisfies(state -> assertThat(state.getUserId()).isEqualTo(second.getId()));
    }
}
