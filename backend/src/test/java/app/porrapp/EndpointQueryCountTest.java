package app.porrapp;

import app.porrapp.config.DataInitializer;
import app.porrapp.controller.CompetitionController;
import app.porrapp.controller.LeaderboardController;
import app.porrapp.controller.LeagueController;
import app.porrapp.controller.MatchController;
import app.porrapp.controller.MatchPredictionController;
import app.porrapp.controller.TournamentController;
import app.porrapp.model.Competition;
import app.porrapp.model.CompetitionTeam;
import app.porrapp.model.Edition;
import app.porrapp.model.League;
import app.porrapp.model.Match;
import app.porrapp.model.MatchPrediction;
import app.porrapp.model.MatchStatusNormalized;
import app.porrapp.model.Membership;
import app.porrapp.model.PoolFormat;
import app.porrapp.model.Prediction;
import app.porrapp.model.Team;
import app.porrapp.model.UserAccount;
import app.porrapp.repository.CompetitionRepository;
import app.porrapp.repository.CompetitionTeamRepository;
import app.porrapp.repository.EditionRepository;
import app.porrapp.repository.MatchPredictionRepository;
import app.porrapp.repository.MatchRepository;
import app.porrapp.repository.MembershipRepository;
import app.porrapp.repository.PredictionRepository;
import app.porrapp.repository.TeamRepository;
import app.porrapp.repository.UserAccountRepository;
import app.porrapp.service.league.LeagueSetup;
import app.porrapp.service.league.LeagueSetupService;
import app.porrapp.service.league.NewLeague;
import app.porrapp.service.sync.SyncService;
import app.porrapp.service.tournament.StandingsService;
import app.porrapp.service.tournament.TopScorerService;
import app.porrapp.sports.EspnSportsDataProvider;
import jakarta.persistence.EntityManagerFactory;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.security.Principal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Cuenta las consultas SQL de las pantallas principales contra Postgres real y con el
 * application.properties de producción, llamando a los controladores como lo hace la web: sin
 * transacción alrededor, para que un dato sin cargar falle igual que en producción.
 * <p>
 * Una liga por jornadas (20 equipos, 380 partidos, 5 miembros con 40 predicciones cada uno) y un Mundial
 * con sus 48 selecciones y 72 partidos de grupos. Cada medida parte de las cachés vacías. Los topes son
 * las consultas que hace hoy cada petición: si una sube, alguna lectura ha vuelto a cargar de más.
 */
@SpringBootTest
@TestPropertySource(locations = "file:src/main/resources/application.properties", properties = {
        "app.jwt.secret=endpoint-query-count-test-secret-0123456789-abcdefgh",
        "spring.jpa.properties.hibernate.generate_statistics=true"})
@Testcontainers(disabledWithoutDocker = true)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class EndpointQueryCountTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withTmpFs(java.util.Map.of("/var/lib/postgresql/data", "rw"))
            .withCommand("postgres", "-c", "fsync=off", "-c", "synchronous_commit=off", "-c", "full_page_writes=off");

    private static final int TEAMS = 20;
    private static final int ROUNDS = 38;
    private static final int PLAYED_ROUNDS = 3;
    private static final int PREDICTED_ROUNDS = 4;
    private static final int MEMBERS = 5;

    /** Sin la sincronización inicial, los goleadores ni la tabla de ESPN, que saldrían a la red. */
    @MockitoBean private DataInitializer dataInitializer;
    @MockitoBean private TopScorerService topScorerService;
    @MockitoBean private SyncService syncService;
    @MockitoBean private EspnSportsDataProvider espnSportsDataProvider;

    @Autowired private LeagueController leagueController;
    @Autowired private MatchController matchController;
    @Autowired private CompetitionController competitionController;
    @Autowired private MatchPredictionController matchPredictionController;
    @Autowired private LeaderboardController leaderboardController;
    @Autowired private TournamentController tournamentController;
    @Autowired private LeagueSetupService leagueSetupService;
    @Autowired private StandingsService standingsService;
    @Autowired private CompetitionRepository competitions;
    @Autowired private CompetitionTeamRepository competitionTeams;
    @Autowired private TeamRepository teams;
    @Autowired private MatchRepository matches;
    @Autowired private UserAccountRepository users;
    @Autowired private EditionRepository editions;
    @Autowired private MembershipRepository memberships;
    @Autowired private PredictionRepository predictions;
    @Autowired private MatchPredictionRepository matchPredictions;
    @Autowired private CacheManager cacheManager;
    @Autowired private EntityManagerFactory entityManagerFactory;
    @Autowired private TransactionTemplate transactions;

    private final Instant now = Instant.now();
    private Statistics statistics;
    private Competition regularLeague;
    private Competition worldCup;
    private League league;
    private Long editionId;
    private Principal member;
    private Match playedMatch;

    @BeforeAll
    void seed() {
        statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        seedMatchdayLeague();
        seedWorldCup();
    }

    @Test
    @DisplayName("Portada de una liga por jornadas")
    void leagueHome() {
        long detail = count(() -> leagueController.getLeague(league.getId(), member));
        long calendar = count(() -> matchController.getMatches(regularLeague.getId()));
        long table = count(() -> competitionController.getCompetitionStandings(regularLeague.getId()));
        report("Portada de liga", "detalle " + detail + ", partidos " + calendar + ", tabla " + table);

        assertThat(detail).as("detalle de la liga").isLessThanOrEqualTo(4);
        assertThat(calendar).as("partidos de la competición").isLessThanOrEqualTo(4);
        assertThat(table).as("tabla de la competición").isLessThanOrEqualTo(2);
    }

    @Test
    @DisplayName("Clasificación de una liga")
    void leaderboard() {
        // Con los puntos guardados invalidados, la primera petición puntúa las cinco porras y las guarda.
        transactions.executeWithoutResult(status -> predictions.clearCalculatedScoresByEditionId(editionId));
        long recalculated = count(() -> leaderboardController.getLeaderboard(league.getId(), member));
        long stored = count(() -> leaderboardController.getLeaderboard(league.getId(), member));
        long byMatchday = count(() -> leaderboardController.getMatchdayBreakdown(league.getId(), member));
        report("Clasificación", "recalculando " + recalculated + ", con puntos guardados " + stored
                + ", por jornadas " + byMatchday);

        assertThat(recalculated).as("clasificación recalculada").isLessThanOrEqualTo(8 + MEMBERS);
        assertThat(stored).as("clasificación con puntos guardados").isLessThanOrEqualTo(7);
        assertThat(byMatchday).as("puntos por jornada").isLessThanOrEqualTo(7);
    }

    @Test
    @DisplayName("Predicciones de una jornada")
    void matchdayPredictions() {
        long round = count(() -> matchPredictionController.getMatchdayFixtures(league.getId(), "Jornada 4", member));
        long season = count(() -> matchPredictionController.getMatchdayFixtures(league.getId(), null, member));
        long friends = count(() -> matchPredictionController.getMatchdayFriendPredictions(playedMatch.getId(),
                league.getId(), member));
        report("Predicciones de jornada", "una jornada " + round + ", temporada entera " + season
                + ", predicciones de la liga en un partido " + friends);

        assertThat(round).as("una jornada").isLessThanOrEqualTo(6);
        assertThat(season).as("temporada entera").isLessThanOrEqualTo(6);
        assertThat(friends).as("predicciones de la liga en un partido").isLessThanOrEqualTo(6);
    }

    @Test
    @DisplayName("Cuadro y grupos de un torneo")
    void bracket() {
        long officialBracket = count(() -> tournamentController.getOfficialBracket(worldCup.getId()));
        long groups = count(() -> tournamentController.getStandings(worldCup.getId()));
        long calendar = count(() -> matchController.getMatches(worldCup.getId()));
        report("Cuadro", "cuadro oficial " + officialBracket + ", grupos " + groups + ", partidos " + calendar);

        assertThat(officialBracket).as("cuadro oficial").isLessThanOrEqualTo(4);
        assertThat(groups).as("grupos").isLessThanOrEqualTo(2);
        assertThat(calendar).as("partidos del torneo").isLessThanOrEqualTo(4);
    }

    /** Sentencias SQL de una petición que encuentra las cachés vacías. */
    private long count(Runnable request) {
        for (String name : cacheManager.getCacheNames()) {
            Cache cache = cacheManager.getCache(name);
            if (cache != null) cache.clear();
        }
        statistics.clear();
        request.run();
        return statistics.getPrepareStatementCount();
    }

    private static void report(String screen, String counts) {
        System.out.println("[SQL] " + screen + ": " + counts);
    }

    private void seedMatchdayLeague() {
        String key = UUID.randomUUID().toString().substring(0, 8);
        regularLeague = competitions.save(Competition.builder().name("Liga " + key).externalId("qc." + key).build());
        List<Team> clubs = new ArrayList<>();
        for (int i = 0; i < TEAMS; i++) {
            Team club = teams.save(Team.builder().name("Club " + key + " " + i).competition(regularLeague).build());
            competitionTeams.save(CompetitionTeam.builder().competition(regularLeague).team(club).build());
            clubs.add(club);
        }
        List<Match> calendar = new ArrayList<>();
        for (int round = 1; round <= ROUNDS; round++) {
            boolean played = round <= PLAYED_ROUNDS;
            Instant day = now.plus((round - PLAYED_ROUNDS) * 7L - 4, ChronoUnit.DAYS);
            for (int i = 0; i < TEAMS / 2; i++) {
                calendar.add(Match.builder().competition(regularLeague)
                        .homeTeam(clubs.get(i)).awayTeam(clubs.get(TEAMS / 2 + (i + round) % (TEAMS / 2)))
                        .round("Jornada " + round).matchDate(day.plus(i, ChronoUnit.HOURS))
                        .finished(played).homeScore(played ? 2 : null).awayScore(played ? i % 3 : null)
                        .status(played ? MatchStatusNormalized.FINISHED : MatchStatusNormalized.SCHEDULED)
                        .externalId("qc-" + UUID.randomUUID()).build());
            }
        }
        calendar = matches.saveAll(calendar);
        playedMatch = calendar.get(0);
        List<Match> predicted = calendar.subList(0, PREDICTED_ROUNDS * TEAMS / 2);

        UserAccount admin = user("Admin " + key);
        league = leagueSetupService.create(new NewLeague("Peña " + key, admin.getGoogleEmail(), regularLeague.getId(),
                PoolFormat.MATCH_DAY, false, null, null), LeagueSetup.NONE);
        Edition edition = editions.findByLeagueIdAndStatus(league.getId(), "ACTIVE").orElseThrow();
        editionId = edition.getId();
        member = admin::getGoogleEmail;
        predict(admin, edition, predicted);
        for (int i = 1; i < MEMBERS; i++) {
            UserAccount user = user("Miembro " + key + " " + i);
            memberships.save(Membership.builder().id(new Membership.MembershipId(user.getId(), league.getId()))
                    .user(user).league(league).role("MEMBER").build());
            predict(user, edition, predicted);
        }
    }

    /** Las 48 selecciones en 12 grupos, sus 72 partidos jugados y dos semifinales por jugar. */
    private void seedWorldCup() {
        worldCup = competitions.findByExternalId(Competition.WORLD_CUP_EXTERNAL_ID).orElseThrow();
        String key = UUID.randomUUID().toString().substring(0, 8);
        List<Team> squads = new ArrayList<>();
        for (char group = 'A'; group <= 'L'; group++) {
            for (int i = 1; i <= 4; i++) {
                String name = "Selección " + key + " " + group + i;
                Team squad = teams.save(Team.builder().name(name).nameEn(name).externalId("qc-" + key + group + i)
                        .build());
                competitionTeams.save(CompetitionTeam.builder().competition(worldCup).team(squad)
                        .groupName(String.valueOf(group)).build());
                squads.add(squad);
            }
        }
        int[][] pairs = {{0, 1}, {2, 3}, {0, 2}, {1, 3}, {0, 3}, {1, 2}};
        List<Match> calendar = new ArrayList<>();
        Instant start = now.minus(20, ChronoUnit.DAYS);
        for (int g = 0; g < 12; g++) {
            for (int[] pair : pairs) {
                calendar.add(Match.builder().competition(worldCup)
                        .homeTeam(squads.get(g * 4 + pair[0])).awayTeam(squads.get(g * 4 + pair[1]))
                        .round("group").groupName(String.valueOf((char) ('A' + g)))
                        .matchDate(start.plus(calendar.size(), ChronoUnit.HOURS))
                        .finished(true).homeScore(calendar.size() % 3).awayScore(calendar.size() % 2)
                        .status(MatchStatusNormalized.FINISHED).externalId("qc-" + UUID.randomUUID()).build());
            }
        }
        for (int i = 0; i < 2; i++) {
            calendar.add(Match.builder().competition(worldCup)
                    .homeTeam(squads.get(i * 8)).awayTeam(squads.get(i * 8 + 4)).round("sf")
                    .matchDate(now.plus(10 + i, ChronoUnit.DAYS)).finished(false)
                    .status(MatchStatusNormalized.SCHEDULED).externalId("qc-" + UUID.randomUUID()).build());
        }
        matches.saveAll(calendar);
        standingsService.recalculate(worldCup);
    }

    private void predict(UserAccount user, Edition edition, List<Match> predicted) {
        Prediction prediction = predictions.save(Prediction.builder().user(user).edition(edition)
                .name(user.getParticipantName()).build());
        matchPredictions.saveAll(predicted.stream()
                .map(match -> MatchPrediction.builder().prediction(prediction).match(match)
                        .homeScore(2).awayScore(1).predictionSign("1").build())
                .toList());
    }

    private UserAccount user(String name) {
        return users.save(UserAccount.builder().googleEmail("qc-" + UUID.randomUUID() + "@test.invalid")
                .googleName(name).participantName(name).build());
    }
}
