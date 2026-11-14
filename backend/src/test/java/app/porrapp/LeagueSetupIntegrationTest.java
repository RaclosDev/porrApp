package app.porrapp;

import app.porrapp.config.DataInitializer;
import app.porrapp.exception.BusinessException;
import app.porrapp.model.Edition;
import app.porrapp.model.League;
import app.porrapp.model.PoolFormat;
import app.porrapp.model.PredictionLockMode;
import app.porrapp.model.UserAccount;
import app.porrapp.repository.EditionRepository;
import app.porrapp.repository.LeagueRepository;
import app.porrapp.repository.UserAccountRepository;
import app.porrapp.scoring.ScoringRuleSet;
import app.porrapp.service.league.LeagueSetup;
import app.porrapp.service.league.LeagueSetupService;
import app.porrapp.service.league.NewLeague;
import app.porrapp.service.sync.SyncService;
import app.porrapp.service.tournament.TopScorerService;
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
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withTmpFs(java.util.Map.of("/var/lib/postgresql/data", "rw"))
            .withCommand("postgres", "-c", "fsync=off", "-c", "synchronous_commit=off", "-c", "full_page_writes=off");

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
        // Nace con los valores generales, guardados enteros: no dependen de los que haya por defecto mañana.
        assertThat(edition.getScoringRulesJson()).isEqualTo(ScoringRuleSet.defaults().toJson());
        assertThat(ScoringRuleSet.forEdition(edition).getChampionPoints()).isEqualTo(50);
    }

    @Test
    @DisplayName("Un cuadro con cierre en fecha fija necesita la fecha: sin ella no se crea")
    void fixedDateWithoutDateIsRejected() {
        UserAccount admin = user("setup-nodate@test.invalid");
        LeagueSetup noDate = new LeagueSetup(null, null, null, PredictionLockMode.FIXED_DATE, null, null);

        assertThatThrownBy(() -> leagueSetupService.create(NewLeague.custom("Cuadro sin fecha", admin.getGoogleEmail(),
                "Torneo", PoolFormat.FULL_BRACKET), noDate))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("hace falta la fecha de cierre");
        LeagueSetup dateWithoutMode = new LeagueSetup(null, null, null, null, null, Instant.now().plus(3, ChronoUnit.DAYS));
        assertThatThrownBy(() -> leagueSetupService.create(NewLeague.custom("Cuadro sin modo", admin.getGoogleEmail(),
                "Torneo", PoolFormat.FULL_BRACKET), dateWithoutMode))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("solo vale con lockMode FIXED_DATE");

        assertThat(leagues.findAll()).noneMatch(league -> league.getName().startsWith("Cuadro sin"));
    }

    @Test
    @DisplayName("Un cuadro creado sin elegir cierre se cierra al empezar su primer partido, no nunca")
    void bracketWithoutLockClosesAtTheFirstMatch() {
        UserAccount admin = user("setup-bracket@test.invalid");

        League created = leagueSetupService.create(NewLeague.custom("Cuadro por defecto", admin.getGoogleEmail(),
                "Torneo", PoolFormat.FULL_BRACKET), LeagueSetup.NONE);

        Edition edition = editions.findByLeagueIdAndStatus(created.getId(), "ACTIVE").orElseThrow();
        assertThat(edition.getLockMode()).isEqualTo(PredictionLockMode.FIRST_MATCH);
    }

    private UserAccount user(String email) {
        return users.save(UserAccount.builder().googleEmail(email).googleName("Admin").participantName("Admin").build());
    }
}
