package com.porra.mundial;

import com.porra.mundial.config.DataInitializer;
import com.porra.mundial.exception.BusinessException;
import com.porra.mundial.model.Edition;
import com.porra.mundial.model.League;
import com.porra.mundial.model.PoolFormat;
import com.porra.mundial.model.PredictionLockMode;
import com.porra.mundial.model.UserAccount;
import com.porra.mundial.repository.EditionRepository;
import com.porra.mundial.repository.LeagueRepository;
import com.porra.mundial.repository.UserAccountRepository;
import com.porra.mundial.scoring.ScoringRuleSet;
import com.porra.mundial.service.league.LeagueSetup;
import com.porra.mundial.service.league.LeagueSetupService;
import com.porra.mundial.service.league.NewLeague;
import com.porra.mundial.service.sync.SyncService;
import com.porra.mundial.service.tournament.TopScorerService;
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

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Crear una liga ya configurada con Postgres real: todo se guarda junto o no se guarda nada. */
@SpringBootTest
@TestPropertySource(locations = "file:src/main/resources/application.properties",
        properties = "app.jwt.secret=league-setup-test-secret-0123456789-abcdefghijklmnop")
@Testcontainers(disabledWithoutDocker = true)
class LeagueSetupIntegrationTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    @MockitoBean private DataInitializer dataInitializer;
    @MockitoBean private TopScorerService topScorerService;
    @MockitoBean private SyncService syncService;

    @Autowired private LeagueSetupService leagueSetupService;
    @Autowired private LeagueRepository leagues;
    @Autowired private EditionRepository editions;
    @Autowired private UserAccountRepository users;

    @Test
    @DisplayName("La liga se crea con sus normas, cuota, puntuación y cierre")
    void createsConfiguredLeague() {
        UserAccount admin = user("setup-ok@test.invalid");
        ScoringRuleSet scoring = ScoringRuleSet.builder().correctSignPoints(4).build();
        LeagueSetup setup = new LeagueSetup("  Bizum a Ana antes de empezar  ", true, scoring,
                PredictionLockMode.PER_DAY, 60, null);

        League created = leagueSetupService.create(NewLeague.custom("Liga configurada", admin.getGoogleEmail(),
                "Torneo del barrio", PoolFormat.MATCH_DAY), setup);

        League league = leagues.findById(created.getId()).orElseThrow();
        assertThat(league.getRules()).isEqualTo("Bizum a Ana antes de empezar");
        assertThat(league.isEntryFee()).isTrue();
        assertThat(league.isPublicLeague()).isFalse();
        Edition edition = editions.findByLeagueIdAndStatus(league.getId(), "ACTIVE").orElseThrow();
        assertThat(ScoringRuleSet.forEdition(edition).getCorrectSignPoints()).isEqualTo(4);
        assertThat(edition.getLockMode()).isEqualTo(PredictionLockMode.PER_DAY);
        assertThat(edition.getLockOffsetMinutes()).isEqualTo(60);
    }

    @Test
    @DisplayName("Un ajuste no válido no deja la liga a medias")
    void invalidSetupCreatesNothing() {
        UserAccount admin = user("setup-bad@test.invalid");
        LeagueSetup pastLock = new LeagueSetup("Normas", null, null, PredictionLockMode.FIXED_DATE, null,
                Instant.now().minus(1, ChronoUnit.DAYS));

        assertThatThrownBy(() -> leagueSetupService.create(NewLeague.custom("Liga rota", admin.getGoogleEmail(),
                "Torneo", PoolFormat.FULL_BRACKET), pastLock))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("futura");

        assertThat(leagues.findAll()).noneMatch(league -> "Liga rota".equals(league.getName()));
    }

    @Test
    @DisplayName("Repetir la creación con la misma clave devuelve la misma liga sin volver a configurarla")
    void repeatedCreationReturnsSameLeague() {
        UserAccount admin = user("setup-repeat@test.invalid");
        NewLeague request = NewLeague.custom("Liga repetida", admin.getGoogleEmail(), "Torneo", PoolFormat.MATCH_DAY)
                .withCreationKey("setup-repeat-key-0001");
        LeagueSetup setup = new LeagueSetup("Normas", null, null, PredictionLockMode.PER_ROUND, 0, null);

        League first = leagueSetupService.create(request, setup);
        League second = leagueSetupService.create(request, setup);

        assertThat(second.getId()).isEqualTo(first.getId());
        assertThat(leagues.findAll()).filteredOn(league -> "Liga repetida".equals(league.getName())).hasSize(1);
    }

    @Test
    @DisplayName("Sin ajustes la liga se crea como siempre")
    void emptySetupKeepsDefaults() {
        UserAccount admin = user("setup-none@test.invalid");

        League created = leagueSetupService.create(NewLeague.custom("Liga simple", admin.getGoogleEmail(),
                "Torneo", PoolFormat.MATCH_DAY), LeagueSetup.NONE);

        League league = leagues.findById(created.getId()).orElseThrow();
        assertThat(league.getRules()).isNull();
        assertThat(league.isEntryFee()).isFalse();
        Edition edition = editions.findByLeagueIdAndStatus(league.getId(), "ACTIVE").orElseThrow();
        assertThat(edition.getLockMode()).isEqualTo(PredictionLockMode.FIXED_DATE);
    }

    private UserAccount user(String email) {
        return users.save(UserAccount.builder().googleEmail(email).googleName("Admin").participantName("Admin").build());
    }
}
