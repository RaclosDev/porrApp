package app.porrapp;

import app.porrapp.config.DataInitializer;
import app.porrapp.dto.LeagueResponseDTO;
import app.porrapp.dto.MatchSelectionRequest;
import app.porrapp.exception.BusinessException;
import app.porrapp.model.Competition;
import app.porrapp.model.Edition;
import app.porrapp.model.League;
import app.porrapp.model.LeagueImage;
import app.porrapp.model.Match;
import app.porrapp.model.MatchSelectionMode;
import app.porrapp.model.MatchStatusNormalized;
import app.porrapp.model.Membership;
import app.porrapp.model.PoolFormat;
import app.porrapp.model.PredictionLockMode;
import app.porrapp.model.Team;
import app.porrapp.model.UserAccount;
import app.porrapp.repository.CompetitionRepository;
import app.porrapp.repository.EditionFollowedTeamRepository;
import app.porrapp.repository.EditionRepository;
import app.porrapp.repository.LeagueImageRepository;
import app.porrapp.repository.LeagueRepository;
import app.porrapp.repository.MatchRepository;
import app.porrapp.repository.MembershipRepository;
import app.porrapp.repository.TeamRepository;
import app.porrapp.repository.UserAccountRepository;
import app.porrapp.scoring.ScoringRuleSet;
import app.porrapp.service.league.LeagueMembershipService;
import app.porrapp.service.league.LeagueRepeatService;
import app.porrapp.service.league.LeagueService;
import app.porrapp.service.league.LeagueSetup;
import app.porrapp.service.league.LeagueSetupService;
import app.porrapp.service.league.NewLeague;
import app.porrapp.service.sync.SyncService;
import app.porrapp.service.tournament.TopScorerService;
import org.junit.jupiter.api.BeforeEach;
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
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Repetir una liga terminada para la temporada nueva, con Postgres real. */
@SpringBootTest
@TestPropertySource(locations = "file:src/main/resources/application.properties",
        properties = "app.jwt.secret=league-repeat-test-secret-0123456789-abcdefghijklmnop")
@Testcontainers(disabledWithoutDocker = true)
class LeagueRepeatIntegrationTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withTmpFs(java.util.Map.of("/var/lib/postgresql/data", "rw"))
            .withCommand("postgres", "-c", "fsync=off", "-c", "synchronous_commit=off", "-c", "full_page_writes=off");

    @MockitoBean private DataInitializer dataInitializer;
    @MockitoBean private TopScorerService topScorerService;
    @MockitoBean private SyncService syncService;

    @Autowired private LeagueSetupService leagueSetupService;
    @Autowired private LeagueRepeatService leagueRepeatService;
    @Autowired private LeagueService leagueService;
    @Autowired private LeagueMembershipService membershipService;
    @Autowired private CompetitionRepository competitions;
    @Autowired private MatchRepository matches;
    @Autowired private TeamRepository teams;
    @Autowired private EditionRepository editions;
    @Autowired private EditionFollowedTeamRepository followedTeams;
    @Autowired private LeagueRepository leagues;
    @Autowired private LeagueImageRepository leagueImages;
    @Autowired private MembershipRepository memberships;
    @Autowired private UserAccountRepository users;

    private final Instant now = Instant.now().truncatedTo(ChronoUnit.HOURS);
    private String key;
    private String externalId;
    private Competition played;
    private Team stays;
    private Team alsoStays;
    private Team relegated;
    private UserAccount admin;
    private UserAccount ana;
    private UserAccount luis;

    @BeforeEach
    void season() {
        key = UUID.randomUUID().toString().substring(0, 8);
        externalId = "rep" + key + ".1";
        played = competition("2025/26");
        stays = team("Sigue");
        alsoStays = team("También sigue");
        relegated = team("Desciende");
        match(played, stays, relegated, now.minus(200, ChronoUnit.DAYS), true);
        match(played, alsoStays, stays, now.minus(100, ChronoUnit.DAYS), true);
        admin = user("admin");
        ana = user("ana");
        luis = user("luis");
    }

    @Test
    @DisplayName("La liga nueva nace con los mismos miembros y ajustes en la temporada nueva; la vieja no cambia")
    void repeatsWithTheSameMembersAndSettings() {
        League old = leagueSetupService.create(official("Los del barrio"), new LeagueSetup("Bizum a Ana", true,
                ScoringRuleSet.builder().correctSignPoints(4).build(), PredictionLockMode.PER_MATCH, 30, null,
                new MatchSelectionRequest(MatchSelectionMode.CUSTOM, List.of(stays.getId(), relegated.getId()),
                        null, null)));
        membershipService.join(old.getId(), ana.getGoogleEmail());
        membershipService.join(old.getId(), luis.getGoogleEmail());
        membershipService.setPayment(old.getId(), ana.getId(), admin.getGoogleEmail(), "PAID");
        image(old);
        Competition next = newSeason();

        LeagueResponseDTO before = leagueService.findLeagueResponse(old.getId(), admin.getGoogleEmail()).orElseThrow();
        assertThat(before.getSeason()).isEqualTo("2025/26");
        assertThat(before.isSeasonEnded()).isTrue();
        assertThat(before.isCanRepeat()).isTrue();
        assertThat(before.getNextSeason()).isEqualTo("2026/27");
        assertThat(before.getNextLeagueId()).isNull();

        League repeated = leagues.findById(leagueRepeatService.repeat(old.getId(), admin.getGoogleEmail()).getId())
                .orElseThrow();

        assertThat(repeated.getId()).isNotEqualTo(old.getId());
        assertThat(repeated.getName()).isEqualTo("Los del barrio");
        assertThat(repeated.getJoinCode()).isNotEqualTo(old.getJoinCode());
        assertThat(repeated.isPublicLeague()).isFalse();
        assertThat(repeated.getRules()).isEqualTo("Bizum a Ana");
        assertThat(repeated.isEntryFee()).isTrue();
        assertThat(repeated.getPreviousLeagueId()).isEqualTo(old.getId());
        assertThat(repeated.getAdminUserId()).isEqualTo(admin.getId());
        // La imagen se copia con su propia clave: la URL de la liga vieja no abre la de la nueva.
        assertThat(leagueImages.findById(repeated.getId())).isPresent();
        assertThat(repeated.getImageKey()).isNotNull().isNotEqualTo(leagues.findById(old.getId()).orElseThrow().getImageKey());

        Edition edition = editions.findByLeagueIdAndStatus(repeated.getId(), "ACTIVE").orElseThrow();
        assertThat(edition.getCompetition().getId()).isEqualTo(next.getId());
        assertThat(edition.getPoolFormat()).isEqualTo(PoolFormat.MATCH_DAY);
        assertThat(ScoringRuleSet.forEdition(edition).getCorrectSignPoints()).isEqualTo(4);
        assertThat(edition.getLockMode()).isEqualTo(PredictionLockMode.PER_MATCH);
        assertThat(edition.getLockOffsetMinutes()).isEqualTo(30);
        // Sigue al equipo que continúa; el que ha descendido ya no juega la temporada nueva.
        assertThat(edition.getMatchSelection()).isEqualTo(MatchSelectionMode.CUSTOM);
        assertThat(followedTeams.findTeamIds(edition.getId())).containsExactly(stays.getId());

        // Los mismos miembros, con la cuota otra vez pendiente y un solo administrador.
        List<Membership> members = memberships.findByLeagueId(repeated.getId());
        assertThat(members).extracting(member -> member.getUser().getId())
                .containsExactlyInAnyOrder(admin.getId(), ana.getId(), luis.getId());
        assertThat(members).allMatch(member -> "PENDING".equals(member.getPaymentStatus()));
        assertThat(members).filteredOn(member -> "ADMIN".equals(member.getRole()))
                .extracting(member -> member.getUser().getId()).containsExactly(admin.getId());

        // La liga terminada se queda como estaba.
        assertThat(memberships.findByLeagueId(old.getId())).hasSize(3);
        assertThat(editions.findByLeagueIdAndStatus(old.getId(), "ACTIVE").orElseThrow().getCompetition().getId())
                .isEqualTo(played.getId());

        LeagueResponseDTO after = leagueService.findLeagueResponse(old.getId(), ana.getGoogleEmail()).orElseThrow();
        assertThat(after.isSeasonEnded()).isTrue();
        assertThat(after.isCanRepeat()).isFalse();
        assertThat(after.getNextLeagueId()).isEqualTo(repeated.getId());
        LeagueResponseDTO fresh = leagueService.findLeagueResponse(repeated.getId(), ana.getGoogleEmail()).orElseThrow();
        assertThat(fresh.getSeason()).isEqualTo("2026/27");
        assertThat(fresh.isSeasonEnded()).isFalse();
        assertThat(leagueService.getUserLeagueDTOs(luis.getGoogleEmail()))
                .filteredOn(dto -> dto.getId().equals(old.getId()))
                .singleElement()
                .satisfies(dto -> assertThat(dto.getNextLeagueId()).isEqualTo(repeated.getId()));
    }

    @Test
    @DisplayName("Repetir dos veces devuelve la misma liga, no otra")
    void repeatingTwiceReturnsTheSameLeague() {
        League old = leagueSetupService.create(official("Liga doble " + key), LeagueSetup.NONE);
        membershipService.join(old.getId(), ana.getGoogleEmail());
        newSeason();

        League first = leagueRepeatService.repeat(old.getId(), admin.getGoogleEmail());
        League second = leagueRepeatService.repeat(old.getId(), admin.getGoogleEmail());

        assertThat(second.getId()).isEqualTo(first.getId());
        assertThat(leagues.findAll()).filteredOn(league -> ("Liga doble " + key).equals(league.getName())).hasSize(2);
        assertThat(memberships.findByLeagueId(first.getId())).hasSize(2);
    }

    @Test
    @DisplayName("Solo el administrador repite la liga: ni un miembro ni alguien de fuera")
    void onlyTheAdminRepeats() {
        League old = leagueSetupService.create(official("Liga ajena " + key), LeagueSetup.NONE);
        membershipService.join(old.getId(), ana.getGoogleEmail());
        newSeason();

        assertThatThrownBy(() -> leagueRepeatService.repeat(old.getId(), ana.getGoogleEmail()))
                .isInstanceOf(BusinessException.class).hasMessageContaining("No tienes permiso");
        assertThatThrownBy(() -> leagueRepeatService.repeat(old.getId(), luis.getGoogleEmail()))
                .isInstanceOf(BusinessException.class).hasMessageContaining("No tienes permiso");

        assertThat(leagues.findByPreviousLeagueId(old.getId())).isEmpty();
        assertThat(memberships.findByUserId(luis.getId())).isEmpty();
    }

    @Test
    @DisplayName("Una liga cuya temporada sigue en juego no se repite")
    void aLeagueInPlayIsNotRepeated() {
        League old = leagueSetupService.create(official("Liga viva " + key), LeagueSetup.NONE);

        assertThatThrownBy(() -> leagueRepeatService.repeat(old.getId(), admin.getGoogleEmail()))
                .isInstanceOf(BusinessException.class).hasMessageContaining("aún no ha terminado");

        LeagueResponseDTO dto = leagueService.findLeagueResponse(old.getId(), admin.getGoogleEmail()).orElseThrow();
        assertThat(dto.isSeasonEnded()).isFalse();
        assertThat(dto.isCanRepeat()).isFalse();
        assertThat(leagues.findByPreviousLeagueId(old.getId())).isEmpty();
    }

    @Test
    @DisplayName("Terminada pero sin temporada nueva en el proveedor: todavía no se puede repetir")
    void withoutANewSeasonThereIsNothingToRepeat() {
        League old = leagueSetupService.create(official("Liga en espera " + key), LeagueSetup.NONE);
        archive();

        assertThatThrownBy(() -> leagueRepeatService.repeat(old.getId(), admin.getGoogleEmail()))
                .isInstanceOf(BusinessException.class).hasMessageContaining("aún no está disponible");

        LeagueResponseDTO dto = leagueService.findLeagueResponse(old.getId(), admin.getGoogleEmail()).orElseThrow();
        assertThat(dto.isSeasonEnded()).isTrue();
        assertThat(dto.isCanRepeat()).isFalse();
    }

    @Test
    @DisplayName("Una liga con competición propia no tiene temporadas que repetir")
    void aCustomCompetitionIsNotRepeated() {
        League old = leagueSetupService.create(NewLeague.custom("Liga propia " + key, admin.getGoogleEmail(),
                "Torneo del barrio", PoolFormat.MATCH_DAY), LeagueSetup.NONE);

        assertThatThrownBy(() -> leagueRepeatService.repeat(old.getId(), admin.getGoogleEmail()))
                .isInstanceOf(BusinessException.class).hasMessageContaining("competición propia");
    }

    @Test
    @DisplayName("Quien sale de la liga nueva deja de verla desde la vieja; si se borra, la vieja se puede repetir otra vez")
    void theNextLeagueStaysPrivateAndCanBeRedone() {
        League old = leagueSetupService.create(official("Liga privada " + key), LeagueSetup.NONE);
        membershipService.join(old.getId(), ana.getGoogleEmail());
        newSeason();
        League repeated = leagueRepeatService.repeat(old.getId(), admin.getGoogleEmail());

        membershipService.leave(repeated.getId(), ana.getGoogleEmail());

        LeagueResponseDTO forAna = leagueService.findLeagueResponse(old.getId(), ana.getGoogleEmail()).orElseThrow();
        assertThat(forAna.getNextLeagueId()).isNull();
        assertThat(forAna.isCanRepeat()).isFalse();
        assertThat(leagueService.findLeagueResponse(repeated.getId(), ana.getGoogleEmail())).isEmpty();

        leagueService.deleteLeague(repeated.getId(), admin.getGoogleEmail());

        LeagueResponseDTO forAdmin = leagueService.findLeagueResponse(old.getId(), admin.getGoogleEmail()).orElseThrow();
        assertThat(forAdmin.isCanRepeat()).isTrue();
        assertThat(leagueRepeatService.repeat(old.getId(), admin.getGoogleEmail()).getId())
                .isNotEqualTo(repeated.getId());
    }

    @Test
    @DisplayName("Borrar la liga terminada no se lleva por delante la que la repite")
    void deletingTheOldLeagueKeepsTheNewOne() {
        League old = leagueSetupService.create(official("Liga borrada " + key), LeagueSetup.NONE);
        newSeason();
        League repeated = leagueRepeatService.repeat(old.getId(), admin.getGoogleEmail());

        leagueService.deleteLeague(old.getId(), admin.getGoogleEmail());

        assertThat(leagues.findById(old.getId())).isEmpty();
        assertThat(leagues.findById(repeated.getId()).orElseThrow().getPreviousLeagueId()).isNull();
    }

    @Test
    @DisplayName("Una liga anterior a los valores generales se repite con las reglas con las que se jugó")
    void repeatsWithTheRulesOfAnOlderLeague() {
        League old = leagueSetupService.create(official("Los de antes"), LeagueSetup.NONE);
        Edition played = editions.findByLeagueIdAndStatus(old.getId(), "ACTIVE").orElseThrow();
        // Como quedó guardada entonces: sin reglas propias, puntuaba con las del Mundial.
        played.setScoringRulesJson(null);
        editions.save(played);
        newSeason();

        League repeated = leagueRepeatService.repeat(old.getId(), admin.getGoogleEmail());

        Edition edition = editions.findByLeagueIdAndStatus(repeated.getId(), "ACTIVE").orElseThrow();
        assertThat(ScoringRuleSet.forEdition(edition)).isEqualTo(ScoringRuleSet.forEdition(played));
        assertThat(ScoringRuleSet.forEdition(edition).getChampionPoints()).isEqualTo(200);
        assertThat(edition.getScoringRulesJson()).contains("\"championPoints\":200");
        // La vieja sigue como estaba.
        assertThat(editions.findById(played.getId()).orElseThrow().getScoringRulesJson()).isNull();
    }

    private NewLeague official(String name) {
        return new NewLeague(name, admin.getGoogleEmail(), played.getId(), PoolFormat.MATCH_DAY, false, null, null);
    }

    /** El proveedor abre la temporada nueva: la jugada se archiva y la nueva ya tiene calendario. */
    private Competition newSeason() {
        archive();
        Competition next = competition("2026/27");
        Team promoted = team("Asciende");
        match(next, stays, alsoStays, now.plus(20, ChronoUnit.DAYS), false);
        match(next, promoted, stays, now.plus(27, ChronoUnit.DAYS), false);
        return next;
    }

    private void archive() {
        Competition row = competitions.findById(played.getId()).orElseThrow();
        row.setArchivedAt(Instant.now());
        competitions.saveAndFlush(row);
    }

    private Competition competition(String season) {
        return competitions.saveAndFlush(Competition.builder().name("Liga de prueba " + key).externalId(externalId)
                .formatType("LEAGUE").season(season).build());
    }

    private Team team(String name) {
        return teams.save(Team.builder().name(name + " " + key).externalId("rep-" + key + "-" + UUID.randomUUID())
                .build());
    }

    private Match match(Competition competition, Team home, Team away, Instant date, boolean finished) {
        Match match = Match.builder().competition(competition).homeTeam(home).awayTeam(away).matchDate(date)
                .round("Jornada 1").externalId("rep-" + key + "-" + UUID.randomUUID()).build();
        if (finished) {
            match.setFinished(true);
            match.setStatus(MatchStatusNormalized.FINISHED);
            match.setHomeScore(1);
            match.setAwayScore(0);
        }
        return matches.save(match);
    }

    private void image(League league) {
        Instant updated = Instant.now();
        leagueImages.save(LeagueImage.builder().leagueId(league.getId()).contentType("image/webp")
                .data(new byte[] {1, 2, 3}).sizeBytes(3).updatedAt(updated).build());
        League row = leagues.findById(league.getId()).orElseThrow();
        row.setImageUpdatedAt(updated);
        row.setImageKey("clave-" + key);
        leagues.save(row);
    }

    private UserAccount user(String name) {
        String email = "repetir-" + name + "-" + key + "@test.invalid";
        return users.save(UserAccount.builder().googleEmail(email).googleName(name).participantName(name).build());
    }
}
