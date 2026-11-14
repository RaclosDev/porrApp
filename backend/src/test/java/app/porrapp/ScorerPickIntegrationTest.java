package app.porrapp;

import app.porrapp.config.DataInitializer;
import app.porrapp.dto.ParticipantScoreDTO;
import app.porrapp.dto.ScorerCandidateDTO;
import app.porrapp.dto.ScorerPickDTO;
import app.porrapp.dto.ScorerPickStateDTO;
import app.porrapp.dto.TopScorerDTO;
import app.porrapp.exception.BusinessException;
import app.porrapp.model.Competition;
import app.porrapp.model.CompetitionPlayer;
import app.porrapp.model.Edition;
import app.porrapp.model.League;
import app.porrapp.model.Match;
import app.porrapp.model.MatchStatusNormalized;
import app.porrapp.model.PoolFormat;
import app.porrapp.model.Team;
import app.porrapp.model.UserAccount;
import app.porrapp.repository.CompetitionPlayerRepository;
import app.porrapp.repository.CompetitionRepository;
import app.porrapp.repository.EditionRepository;
import app.porrapp.repository.MatchRepository;
import app.porrapp.repository.TeamRepository;
import app.porrapp.repository.UserAccountRepository;
import app.porrapp.scoring.ScoringRuleSet;
import app.porrapp.service.league.LeagueMembershipService;
import app.porrapp.service.league.LeagueSetup;
import app.porrapp.service.league.LeagueSetupService;
import app.porrapp.service.league.NewLeague;
import app.porrapp.service.league.ScorerPickService;
import app.porrapp.service.prediction.LeaderboardService;
import app.porrapp.service.prediction.ScoreInvalidationService;
import app.porrapp.service.sync.SyncService;
import app.porrapp.service.tournament.CompetitionPlayerService;
import app.porrapp.service.tournament.TopScorerService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/** Pichichi de una liga por jornadas de una competición de fútbol cualquiera, con Postgres real. */
@SpringBootTest
@TestPropertySource(locations = "file:src/main/resources/application.properties",
        properties = "app.jwt.secret=scorer-pick-test-secret-0123456789-abcdefghijklmnop")
@Testcontainers(disabledWithoutDocker = true)
class ScorerPickIntegrationTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withTmpFs(java.util.Map.of("/var/lib/postgresql/data", "rw"))
            .withCommand("postgres", "-c", "fsync=off", "-c", "synchronous_commit=off", "-c", "full_page_writes=off");

    @MockitoBean private DataInitializer dataInitializer;
    @MockitoBean private TopScorerService topScorerService;
    @MockitoBean private SyncService syncService;

    @Autowired private LeagueSetupService leagueSetupService;
    @Autowired private LeagueMembershipService membershipService;
    @Autowired private ScorerPickService scorerPickService;
    @Autowired private CompetitionPlayerService competitionPlayerService;
    @Autowired private LeaderboardService leaderboardService;
    @Autowired private ScoreInvalidationService scoreInvalidation;
    @Autowired private CompetitionRepository competitions;
    @Autowired private CompetitionPlayerRepository players;
    @Autowired private MatchRepository matches;
    @Autowired private TeamRepository teams;
    @Autowired private EditionRepository editions;
    @Autowired private UserAccountRepository users;

    private final Instant now = Instant.now().truncatedTo(ChronoUnit.SECONDS);
    private String key;
    private Competition competition;
    private Team home;
    private Team away;
    private Match opener;
    private UserAccount admin;
    private UserAccount ana;
    private UserAccount luis;

    @BeforeEach
    void season() {
        key = UUID.randomUUID().toString().substring(0, 8);
        competition = competitions.saveAndFlush(Competition.builder().name("Liga de goles " + key)
                .externalId("gol" + key + ".1").formatType("LEAGUE").season("2026/27").build());
        home = team("Local");
        away = team("Visitante");
        opener = match(now.plus(3, ChronoUnit.DAYS));
        admin = user("admin");
        ana = user("ana");
        luis = user("luis");
        when(topScorerService.getTopScorers(any(Competition.class))).thenReturn(List.of());
    }

    @Test
    @DisplayName("Una liga por jornadas de fútbol juega el pichichi si se pide, aparte del cuadro y hasta el primer partido")
    void aMatchdayFootballLeaguePlaysThePichichi() {
        League league = league(true);

        ScorerPickStateDTO state = scorerPickService.state(league.getId(), ana.getGoogleEmail());

        assertThat(state.enabled()).isTrue();
        assertThat(state.inBracket()).isFalse();
        assertThat(state.locked()).isFalse();
        assertThat(state.lockAt()).isEqualTo(opener.getMatchDate());
        assertThat(state.mine()).isNull();
        // Sin pedirlo, sigue sin jugarse fuera de un torneo con grupos.
        League plain = leagueSetupService.create(NewLeague.of("Sin pichichi " + key, admin.getGoogleEmail(),
                competition.getId(), PoolFormat.MATCH_DAY), LeagueSetup.NONE);
        assertThat(scorerPickService.state(plain.getId(), admin.getGoogleEmail()).enabled()).isFalse();
        assertThatThrownBy(() -> scorerPickService.save(plain.getId(), admin.getGoogleEmail(), "Mbappé", null))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    @DisplayName("Con plantillas se elige de la lista o se escribe, y lo escrito queda como el jugador real")
    void withSquadsThePickIsARealPlayer() {
        squads();
        League league = league(true);

        ScorerPickDTO chosen = scorerPickService.save(league.getId(), ana.getGoogleEmail(), null, "p-mbappe").mine();
        ScorerPickDTO written = scorerPickService.save(league.getId(), luis.getGoogleEmail(), "lewandoski", null).mine();

        assertThat(chosen.status()).isEqualTo(ScorerPickDTO.PLAYER);
        assertThat(chosen.playerName()).isEqualTo("Kylian Mbappé");
        assertThat(chosen.team()).isEqualTo("Real Madrid");
        assertThat(written.status()).isEqualTo(ScorerPickDTO.PLAYER);
        assertThat(written.writtenName()).isEqualTo("lewandoski");
        assertThat(written.playerId()).isEqualTo("p-lewandowski");
        assertThat(written.playerName()).isEqualTo("Robert Lewandowski");
        assertThat(competitionPlayerService.players(competition.getId())).extracting(ScorerCandidateDTO::name)
                .containsExactly("Gonçalo Ramos", "Kylian Mbappé", "Robert Lewandowski", "Sergio Ramos");
        assertThatThrownBy(() -> scorerPickService.save(league.getId(), ana.getGoogleEmail(), null, "p-de-otra-liga"))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST));
        // Cambiarlo y quitarlo mientras el plazo siga abierto.
        assertThat(scorerPickService.save(league.getId(), ana.getGoogleEmail(), "Sergio Ramos", null).mine().playerId())
                .isEqualTo("p-sergio");
        assertThat(scorerPickService.save(league.getId(), ana.getGoogleEmail(), "  ", null).mine()).isNull();
    }

    @Test
    @DisplayName("Con el plazo abierto cada uno ve solo su pichichi; cerrado, se ven todos y ya no se cambia")
    void picksAreHiddenUntilTheDeadline() {
        squads();
        League league = league(true);
        scorerPickService.save(league.getId(), ana.getGoogleEmail(), "Mbappé", null);
        scorerPickService.save(league.getId(), luis.getGoogleEmail(), "Lewandowski", null);

        assertThat(scorerPickService.picks(league.getId(), ana.getGoogleEmail()))
                .extracting(ScorerPickDTO::writtenName).containsExactly("Mbappé");
        assertThat(scorerPickService.picks(league.getId(), admin.getGoogleEmail())).isEmpty();
        assertThat(scorerPickService.picks(league.getId(), null)).isEmpty();

        kickOff(league);

        assertThat(scorerPickService.state(league.getId(), ana.getGoogleEmail()).locked()).isTrue();
        assertThat(scorerPickService.picks(league.getId(), ana.getGoogleEmail()))
                .extracting(ScorerPickDTO::writtenName).containsExactlyInAnyOrder("Mbappé", "Lewandowski");
        assertThatThrownBy(() -> scorerPickService.save(league.getId(), ana.getGoogleEmail(), "Lewandowski", null))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getStatus()).isEqualTo(HttpStatus.CONFLICT));
    }

    @Test
    @DisplayName("Si la competición ya estaba en juego al crear la liga, hay una semana para elegir")
    void aLeagueCreatedMidSeasonGivesAWeek() {
        match(now.minus(30, ChronoUnit.DAYS));
        Match afterAWeek = match(now.plus(9, ChronoUnit.DAYS));

        League league = league(true);

        assertThat(scorerPickService.state(league.getId(), ana.getGoogleEmail()).lockAt())
                .isEqualTo(afterAWeek.getMatchDate());
    }

    @Test
    @DisplayName("El administrador asigna un pichichi dudoso, solo tras el cierre y solo entre los que encajan")
    void theAdminResolvesADoubtfulPick() {
        squads();
        League league = league(true);
        scorerPickService.save(league.getId(), ana.getGoogleEmail(), "Ramos", null);
        scorerPickService.save(league.getId(), luis.getGoogleEmail(), "Mbappé", null);
        Long anaPick = scorerPickService.state(league.getId(), ana.getGoogleEmail()).mine().predictionId();
        Long luisPick = scorerPickService.state(league.getId(), luis.getGoogleEmail()).mine().predictionId();

        // Antes del cierre no: aún no puede ver lo que han elegido los demás.
        assertThatThrownBy(() -> scorerPickService.assign(league.getId(), anaPick, "p-goncalo", admin.getGoogleEmail()))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getStatus()).isEqualTo(HttpStatus.CONFLICT));
        kickOff(league);

        ScorerPickDTO doubtful = pick(league, ana);
        assertThat(doubtful.status()).isEqualTo(ScorerPickDTO.DOUBTFUL);
        assertThat(doubtful.canAssign()).isTrue();
        assertThat(doubtful.candidates()).extracting(ScorerCandidateDTO::name)
                .containsExactlyInAnyOrder("Gonçalo Ramos", "Sergio Ramos");
        assertThat(scorerPickService.state(league.getId(), admin.getGoogleEmail()).canResolve()).isTrue();
        assertThat(scorerPickService.state(league.getId(), ana.getGoogleEmail()).canResolve()).isFalse();

        assertThatThrownBy(() -> scorerPickService.assign(league.getId(), anaPick, "p-goncalo", ana.getGoogleEmail()))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getStatus()).isEqualTo(HttpStatus.FORBIDDEN));
        // «Ramos» no puede acabar siendo Mbappé, ni se toca un pichichi que no es dudoso.
        assertThatThrownBy(() -> scorerPickService.assign(league.getId(), anaPick, "p-mbappe", admin.getGoogleEmail()))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST));
        assertThatThrownBy(() -> scorerPickService.assign(league.getId(), luisPick, "p-goncalo", admin.getGoogleEmail()))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getStatus()).isEqualTo(HttpStatus.CONFLICT));

        ScorerPickDTO assigned = scorerPickService.assign(league.getId(), anaPick, "p-goncalo", admin.getGoogleEmail());

        assertThat(assigned.status()).isEqualTo(ScorerPickDTO.PLAYER);
        assertThat(assigned.playerName()).isEqualTo("Gonçalo Ramos");
        assertThat(assigned.byAdmin()).isTrue();
        assertThat(assigned.writtenName()).isEqualTo("Ramos");
        assertThat(pick(league, ana).canAssign()).as("puede corregirlo").isTrue();
        // Y deshacerlo: vuelve a quedar dudoso.
        assertThat(scorerPickService.assign(league.getId(), anaPick, null, admin.getGoogleEmail()).status())
                .isEqualTo(ScorerPickDTO.DOUBTFUL);
    }

    @Test
    @DisplayName("Al terminar la liga puntúa quien acertó el máximo goleador, lo eligiera, lo escribiera o se lo asignaran")
    void theTopScorerIsAwardedWhenTheLeagueEnds() {
        League league = league(true);
        UserAccount eva = user("eva");
        UserAccount teo = user("teo");
        membershipService.join(league.getId(), eva.getGoogleEmail());
        membershipService.join(league.getId(), teo.getGoogleEmail());
        // Sin plantillas todavía: lo escrito se guarda tal cual y se empareja con los goleadores.
        scorerPickService.save(league.getId(), ana.getGoogleEmail(), "mbape", null);
        scorerPickService.save(league.getId(), luis.getGoogleEmail(), "Lewandowski", null);
        scorerPickService.save(league.getId(), eva.getGoogleEmail(), "el siete del madrid", null);
        squads();
        scorerPickService.save(league.getId(), teo.getGoogleEmail(), null, "p-mbappe");
        when(topScorerService.getTopScorers(any(Competition.class))).thenReturn(List.of(
                new TopScorerDTO("Kylian Mbappé", "K. Mbappé", 31, "F", "p-mbappe", "Real Madrid", ""),
                new TopScorerDTO("Robert Lewandowski", "R. Lewandowski", 27, "F", "p-lewandowski", "Barcelona", "")));
        kickOff(league);
        Long evaPick = pick(league, eva).predictionId();
        assertThat(pick(league, ana).status()).isEqualTo(ScorerPickDTO.MATCHED);
        assertThat(pick(league, ana).playerName()).isEqualTo("Kylian Mbappé");
        assertThat(pick(league, eva).status()).isEqualTo(ScorerPickDTO.DOUBTFUL);
        scorerPickService.assign(league.getId(), evaPick, "p-mbappe", admin.getGoogleEmail());

        // Con la liga en juego el pichichi aún no da puntos.
        assertThat(scorerPoints(league)).containsAllEntriesOf(Map.of("ana", 0, "luis", 0, "eva", 0, "teo", 0));

        finish(league);

        // Los puntos por defecto de una liga nueva: los de la puntuación general, no los del Mundial.
        int award = new ScoringRuleSet().getTopScorerPoints();
        Map<String, Integer> points = scorerPoints(league);
        assertThat(points).containsAllEntriesOf(Map.of("ana", award, "luis", 0, "eva", award, "teo", award));
        ParticipantScoreDTO evaScore = leaderboardService.getLeaderboard(league.getId()).stream()
                .filter(score -> eva.getId().equals(score.getUserId())).findFirst().orElseThrow();
        assertThat(evaScore.getTotal()).isEqualTo(award);
        assertThat(evaScore.getLog()).extracting(ParticipantScoreDTO.LogEntry::getMsg)
                .contains("Pichichi: Kylian Mbappé (asignado por el administrador) acertado");
        // Terminada, ya no se reasigna.
        assertThatThrownBy(() -> scorerPickService.assign(league.getId(), evaPick, null, admin.getGoogleEmail()))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getStatus()).isEqualTo(HttpStatus.CONFLICT));
    }

    private League league(boolean pichichi) {
        League league = leagueSetupService.create(new NewLeague("Los del gol " + key + " " + UUID.randomUUID(),
                admin.getGoogleEmail(), competition.getId(), PoolFormat.MATCH_DAY, pichichi, null, null),
                LeagueSetup.NONE);
        membershipService.join(league.getId(), ana.getGoogleEmail());
        membershipService.join(league.getId(), luis.getGoogleEmail());
        return league;
    }

    /** El proveedor publica las plantillas de la competición. */
    private void squads() {
        player("p-mbappe", "Kylian Mbappé", "K. Mbappé", "Real Madrid");
        player("p-lewandowski", "Robert Lewandowski", "R. Lewandowski", "Barcelona");
        player("p-goncalo", "Gonçalo Ramos", "G. Ramos", "Paris Saint-Germain");
        player("p-sergio", "Sergio Ramos", "S. Ramos", "Sevilla");
    }

    private void player(String id, String name, String shortName, String team) {
        players.save(CompetitionPlayer.builder().competitionId(competition.getId()).playerId(id).name(name)
                .shortName(shortName).team(team).playerPosition("F").fetchedAt(now).build());
    }

    /** Empieza el primer partido: la liga llevaba días creada. */
    private void kickOff(League league) {
        Edition edition = editions.findByLeagueIdAndStatus(league.getId(), "ACTIVE").orElseThrow();
        edition.setCreatedAt(now.minus(10, ChronoUnit.DAYS));
        editions.saveAndFlush(edition);
        opener.setMatchDate(now.minus(1, ChronoUnit.HOURS));
        opener = matches.saveAndFlush(opener);
    }

    /** Se juega el último partido de la competición. */
    private void finish(League league) {
        opener.setFinished(true);
        opener.setStatus(MatchStatusNormalized.FINISHED);
        opener.setHomeScore(2);
        opener.setAwayScore(1);
        opener = matches.saveAndFlush(opener);
        Edition edition = editions.findByLeagueIdAndStatus(league.getId(), "ACTIVE").orElseThrow();
        scoreInvalidation.invalidateEdition(edition.getId());
    }

    private ScorerPickDTO pick(League league, UserAccount user) {
        return scorerPickService.picks(league.getId(), admin.getGoogleEmail()).stream()
                .filter(pick -> user.getId().equals(pick.userId())).findFirst().orElseThrow();
    }

    /** Puntos de pichichi de cada participante, por su nombre. */
    private Map<String, Integer> scorerPoints(League league) {
        return leaderboardService.getLeaderboard(league.getId()).stream()
                .collect(Collectors.toMap(ParticipantScoreDTO::getName, ParticipantScoreDTO::getScorer));
    }

    private Team team(String name) {
        return teams.save(Team.builder().name(name + " " + key).externalId("gol-" + key + "-" + UUID.randomUUID())
                .build());
    }

    private Match match(Instant date) {
        return matches.save(Match.builder().competition(competition).homeTeam(home).awayTeam(away).matchDate(date)
                .round("Jornada 1").externalId("gol-" + key + "-" + UUID.randomUUID()).build());
    }

    private UserAccount user(String name) {
        String email = "pichichi-" + name + "-" + key + "@test.invalid";
        return users.save(UserAccount.builder().googleEmail(email).googleName(name).participantName(name).build());
    }
}
