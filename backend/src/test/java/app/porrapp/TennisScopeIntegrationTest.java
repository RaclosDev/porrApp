package app.porrapp;

import app.porrapp.config.DataInitializer;
import app.porrapp.dto.MatchPredictionItemDTO;
import app.porrapp.dto.MatchSelectionRequest;
import app.porrapp.dto.MatchdayFixturePredictionDTO;
import app.porrapp.dto.MatchdayPointsDTO;
import app.porrapp.dto.ParticipantScoreDTO;
import app.porrapp.exception.BusinessException;
import app.porrapp.model.Competition;
import app.porrapp.model.Edition;
import app.porrapp.model.League;
import app.porrapp.model.Match;
import app.porrapp.model.MatchSelectionMode;
import app.porrapp.model.MatchStatusNormalized;
import app.porrapp.model.PoolFormat;
import app.porrapp.model.PredictionLockMode;
import app.porrapp.model.Team;
import app.porrapp.model.TennisScope;
import app.porrapp.model.TennisTour;
import app.porrapp.model.UserAccount;
import app.porrapp.repository.CompetitionRepository;
import app.porrapp.repository.EditionRepository;
import app.porrapp.repository.MatchRepository;
import app.porrapp.repository.TeamRepository;
import app.porrapp.repository.UserAccountRepository;
import app.porrapp.service.league.LeagueSetup;
import app.porrapp.service.league.LeagueSetupService;
import app.porrapp.service.league.NewLeague;
import app.porrapp.service.prediction.LeaderboardService;
import app.porrapp.service.prediction.MatchPredictionService;
import app.porrapp.service.prediction.MatchSelectionService;
import app.porrapp.service.sync.SyncService;
import app.porrapp.service.tournament.TopScorerService;
import app.porrapp.util.AppTime;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Ligas de tenis que siguen varios torneos (todos, Grand Slams o Masters 1000), con Postgres real. */
@SpringBootTest
@TestPropertySource(locations = "file:src/main/resources/application.properties",
        properties = "app.jwt.secret=shared-integration-test-secret-0123456789-abcdefghijklmnop")
@Testcontainers(disabledWithoutDocker = true)
class TennisScopeIntegrationTest {

    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = SharedPostgres.integration();

    @MockitoBean private DataInitializer dataInitializer;
    @MockitoBean private TopScorerService topScorerService;
    @MockitoBean private SyncService syncService;

    @Autowired private LeagueSetupService leagueSetupService;
    @Autowired private MatchPredictionService matchPredictionService;
    @Autowired private MatchSelectionService matchSelectionService;
    @Autowired private LeaderboardService leaderboardService;
    @Autowired private CompetitionRepository competitions;
    @Autowired private MatchRepository matches;
    @Autowired private TeamRepository teams;
    @Autowired private EditionRepository editions;
    @Autowired private UserAccountRepository users;

    private final Instant now = Instant.now().truncatedTo(ChronoUnit.HOURS);
    private String key;
    private Competition rolandGarros;
    private Competition rolandGarrosWomen;
    private Competition wimbledon;
    private Competition monteCarlo;
    private Competition atpFinals;

    @BeforeEach
    void catalog() {
        key = UUID.randomUUID().toString().substring(0, 8);
        // Los cuadros del catálogo tienen ids externos fijos: los crea el primer test y los usan todos.
        rolandGarros = competition("Roland Garros · masculino", "tennis.atp.172");
        rolandGarrosWomen = competition("Roland Garros · femenino", "tennis.wta.172");
        wimbledon = competition("Wimbledon · masculino", "tennis.atp.188");
        monteCarlo = competition("Masters de Montecarlo", "tennis.atp.42");
        atpFinals = competition("ATP Finals", "tennis.atp.339");
    }

    @Test
    @DisplayName("Una liga de Grand Slams junta sus cuadros desde hoy, por torneo y ronda, y suma los puntos")
    void grandSlams() {
        Match oldFinal = match(rolandGarros, "final", now.minus(200, ChronoUnit.DAYS));
        Match rgOctavos = match(rolandGarros, "r16", now.plus(2, ChronoUnit.DAYS));
        Match rgWomen = match(rolandGarrosWomen, "qf", now.plus(4, ChronoUnit.DAYS));
        Match monteCarloQuarter = match(monteCarlo, "qf", now.plus(10, ChronoUnit.DAYS));
        Match wimbledonFinal = match(wimbledon, "final", now.plus(40, ChronoUnit.DAYS));

        UserAccount ana = user();
        League league = create(ana, rolandGarros, selection(TennisScope.GRAND_SLAMS, TennisTour.BOTH));
        Edition edition = editions.findByLeagueIdAndStatus(league.getId(), "ACTIVE").orElseThrow();
        assertThat(edition.getTennisScope()).isEqualTo(TennisScope.GRAND_SLAMS);
        assertThat(edition.getTennisTour()).isEqualTo(TennisTour.BOTH);
        assertThat(edition.isMultiCompetition()).isTrue();

        List<Long> ids = fixtures(ana, league).stream().map(MatchdayFixturePredictionDTO::getMatchId).toList();
        assertThat(ids).contains(rgOctavos.getId(), rgWomen.getId(), wimbledonFinal.getId())
                .doesNotContain(oldFinal.getId(), monteCarloQuarter.getId());

        // Cada torneo con su año y su ronda, en orden; los dos cuadros de Roland Garros comparten torneo (los
        // demás tests de la clase usan los mismos cuadros, así que puede haber más jornadas).
        String rgYear = "Roland Garros " + AppTime.day(rgOctavos.getMatchDate()).getYear();
        String wimbledonLabel = "Wimbledon " + AppTime.day(wimbledonFinal.getMatchDate()).getYear() + " · Final";
        assertThat(leaderboardService.getMatchdayBreakdown(league.getId())).extracting(MatchdayPointsDTO::getLabel)
                .containsSubsequence(rgYear + " · Octavos de final", rgYear + " · Cuartos de final", wimbledonLabel)
                .noneMatch(label -> label.contains("Montecarlo"));
        assertThat(fixtures(ana, league, wimbledonLabel)).extracting(MatchdayFixturePredictionDTO::getMatchId)
                .containsExactly(wimbledonFinal.getId());

        // Ni la final del año pasado ni un Masters se pueden predecir en esta liga.
        assertThatThrownBy(() -> predict(ana, league, oldFinal, "1"))
                .isInstanceOf(BusinessException.class).hasMessageContaining("no entra");
        assertThatThrownBy(() -> predict(ana, league, monteCarloQuarter, "1"))
                .isInstanceOf(BusinessException.class);

        predict(ana, league, rgOctavos, "1");
        predict(ana, league, wimbledonFinal, "1");
        finish(rgOctavos);
        finish(wimbledonFinal);
        int total = leaderboardService.getLeaderboard(league.getId()).getFirst().getTotal();
        assertThat(total).isPositive();
        assertThat(leaderboardService.getLeaderboard(league.getId())).singleElement()
                .extracting(ParticipantScoreDTO::getTotal).isEqualTo(total);
    }

    @Test
    @DisplayName("Solo ATP deja fuera los cuadros femeninos, y Masters 1000 incluye las ATP Finals")
    void toursAndMasters() {
        Match rgMen = match(rolandGarros, "r16", now.plus(2, ChronoUnit.DAYS));
        Match rgWomen = match(rolandGarrosWomen, "r16", now.plus(2, ChronoUnit.DAYS));
        Match monteCarloQuarter = match(monteCarlo, "qf", now.plus(10, ChronoUnit.DAYS));
        Match finals = match(atpFinals, "roundrobin", now.plus(20, ChronoUnit.DAYS));

        UserAccount ana = user();
        League atp = create(ana, rolandGarros, selection(TennisScope.GRAND_SLAMS, TennisTour.ATP));
        assertThat(fixtures(ana, atp)).extracting(MatchdayFixturePredictionDTO::getMatchId)
                .contains(rgMen.getId()).doesNotContain(rgWomen.getId());

        League wta = create(ana, rolandGarrosWomen, selection(TennisScope.ALL, TennisTour.WTA));
        assertThat(fixtures(ana, wta)).extracting(MatchdayFixturePredictionDTO::getMatchId)
                .contains(rgWomen.getId()).doesNotContain(rgMen.getId(), monteCarloQuarter.getId());

        League masters = create(ana, monteCarlo, selection(TennisScope.MASTERS_1000, TennisTour.BOTH));
        assertThat(fixtures(ana, masters)).extracting(MatchdayFixturePredictionDTO::getMatchId)
                .contains(monteCarloQuarter.getId(), finals.getId()).doesNotContain(rgMen.getId());

        // El torneo de la liga tiene que ser uno de los que sigue.
        assertThatThrownBy(() -> create(ana, rolandGarros, selection(TennisScope.MASTERS_1000, TennisTour.BOTH)))
                .isInstanceOf(BusinessException.class).hasMessageContaining("no entra");
    }

    @Test
    @DisplayName("Una liga de un torneo sigue como hasta ahora, y la barrida suma a las de varios los cuadros nuevos")
    void singleTournamentAndSweep() {
        Match rgMen = match(rolandGarros, "r16", now.plus(2, ChronoUnit.DAYS));
        UserAccount ana = user();
        League single = create(ana, rolandGarros, null);
        Edition singleEdition = editions.findByLeagueIdAndStatus(single.getId(), "ACTIVE").orElseThrow();
        assertThat(singleEdition.getTennisScope()).isNull();
        assertThat(singleEdition.isMultiCompetition()).isFalse();
        assertThat(fixtures(ana, single)).extracting(MatchdayFixturePredictionDTO::getRound).contains("Octavos de final");

        League all = create(ana, rolandGarros, selection(TennisScope.GRAND_SLAMS, TennisTour.BOTH));
        // Un Grand Slam que el catálogo aún no tenía cuando se creó la liga.
        Competition usOpen = competition("US Open · masculino", "tennis.atp.189");
        Match usOpenFinal = match(usOpen, "final", now.plus(60, ChronoUnit.DAYS));
        assertThat(fixtures(ana, all)).extracting(MatchdayFixturePredictionDTO::getMatchId)
                .contains(rgMen.getId()).doesNotContain(usOpenFinal.getId());

        assertThat(matchSelectionService.syncTennisScopes()).isPositive();
        assertThat(fixtures(ana, all)).extracting(MatchdayFixturePredictionDTO::getMatchId)
                .contains(rgMen.getId(), usOpenFinal.getId());
        assertThat(fixtures(ana, single)).extracting(MatchdayFixturePredictionDTO::getMatchId)
                .doesNotContain(usOpenFinal.getId());
        assertThat(matchSelectionService.syncTennisScopes()).isZero();
    }

    @Test
    @DisplayName("Una liga de varios torneos no sigue los de otra temporada y conserva los suyos cuando se archivan")
    void otherSeasonsStayOut() {
        Competition usOpen = competition("US Open · masculino", "tennis.atp.189");
        try {
            season(rolandGarros, "2026");
            season(wimbledon, "2026");
            season(usOpen, "2027");
            Match rgMen = match(rolandGarros, "r16", now.plus(2, ChronoUnit.DAYS));
            Match wimbledonFinal = match(wimbledon, "final", now.plus(40, ChronoUnit.DAYS));
            Match nextUsOpen = match(usOpen, "final", now.plus(60, ChronoUnit.DAYS));
            UserAccount ana = user();

            League league = create(ana, rolandGarros, selection(TennisScope.GRAND_SLAMS, TennisTour.ATP));
            matchSelectionService.syncTennisScopes();

            assertThat(fixtures(ana, league)).extracting(MatchdayFixturePredictionDTO::getMatchId)
                    .contains(rgMen.getId(), wimbledonFinal.getId()).doesNotContain(nextUsOpen.getId());

            // Wimbledon cambia de temporada: la liga se queda con el suyo y no coge el del año siguiente.
            Competition archived = competitions.findById(wimbledon.getId()).orElseThrow();
            archived.setArchivedAt(Instant.now());
            competitions.saveAndFlush(archived);
            Competition nextWimbledon = competitions.save(Competition.builder().name(archived.getName())
                    .externalId(archived.getExternalId()).formatType("TOURNAMENT").season("2027").build());
            Match nextFinal = match(nextWimbledon, "final", now.plus(300, ChronoUnit.DAYS));
            matchSelectionService.syncTennisScopes();

            assertThat(fixtures(ana, league)).extracting(MatchdayFixturePredictionDTO::getMatchId)
                    .contains(rgMen.getId(), wimbledonFinal.getId())
                    .doesNotContain(nextUsOpen.getId(), nextFinal.getId());
        } finally {
            // Los cuadros del catálogo son de todos los tests: vuelven a quedar sin temporada.
            for (String externalId : List.of("tennis.atp.172", "tennis.atp.188", "tennis.atp.189")) {
                competitions.findByExternalId(externalId).ifPresent(row -> season(row, null));
            }
        }
    }

    private void season(Competition competition, String season) {
        Competition row = competitions.findById(competition.getId()).orElseThrow();
        row.setSeason(season);
        competitions.saveAndFlush(row);
    }

    @Test
    @DisplayName("Una liga de un torneo con los dos cuadros se crea con el femenino, no solo con el masculino")
    void singleTournamentBothDraws() {
        Match rgMen = match(rolandGarros, "r16", now.plus(2, ChronoUnit.DAYS));
        Match rgWomen = match(rolandGarrosWomen, "r16", now.plus(3, ChronoUnit.DAYS));
        UserAccount ana = user();
        League league = create(ana, rolandGarros, new MatchSelectionRequest(MatchSelectionMode.ALL, null, null, null,
                List.of(rolandGarros.getId(), rolandGarrosWomen.getId())));

        Edition edition = editions.findByLeagueIdAndStatus(league.getId(), "ACTIVE").orElseThrow();
        assertThat(edition.isMultiCompetition()).isTrue();
        assertThat(edition.getMatchSelection()).isEqualTo(MatchSelectionMode.ALL);
        assertThat(fixtures(ana, league)).extracting(MatchdayFixturePredictionDTO::getMatchId)
                .contains(rgMen.getId(), rgWomen.getId());
    }

    private static MatchSelectionRequest selection(TennisScope scope, TennisTour tour) {
        return new MatchSelectionRequest(MatchSelectionMode.ALL, null, null, null, null, null, null, scope, tour);
    }

    private Competition competition(String name, String externalId) {
        return competitions.findByExternalId(externalId).orElseGet(() -> competitions.save(Competition.builder()
                .name(name).externalId(externalId).formatType("TOURNAMENT").build()));
    }

    private Match match(Competition competition, String round, Instant date) {
        Team home = teams.save(Team.builder().name("Local " + UUID.randomUUID().toString().substring(0, 6))
                .competition(competition).build());
        Team away = teams.save(Team.builder().name("Visitante " + UUID.randomUUID().toString().substring(0, 6))
                .competition(competition).build());
        return matches.save(Match.builder().competition(competition).homeTeam(home).awayTeam(away).matchDate(date)
                .round(round).externalId("tennis-" + key + "-" + UUID.randomUUID()).build());
    }

    private void finish(Match match) {
        Match saved = matches.findById(match.getId()).orElseThrow();
        saved.setFinished(true);
        saved.setStatus(MatchStatusNormalized.FINISHED);
        saved.setHomeScore(3);
        saved.setAwayScore(0);
        saved.setWinnerTeam(saved.getHomeTeam());
        matchPredictionService.evaluatePredictionsForMatch(matches.save(saved));
    }

    private League create(UserAccount admin, Competition competition, MatchSelectionRequest selection) {
        return leagueSetupService.create(new NewLeague("Tenis " + key, admin.getGoogleEmail(), competition.getId(),
                        PoolFormat.MATCH_DAY, false, null, null),
                new LeagueSetup(null, null, null, PredictionLockMode.PER_MATCH, 0, null, selection));
    }

    private List<MatchdayFixturePredictionDTO> fixtures(UserAccount user, League league) {
        return fixtures(user, league, null);
    }

    private List<MatchdayFixturePredictionDTO> fixtures(UserAccount user, League league, String round) {
        return new ArrayList<>(matchPredictionService.getMatchdayFixtures(user.getGoogleEmail(), league.getId(), round));
    }

    private void predict(UserAccount user, League league, Match match, String sign) {
        MatchPredictionItemDTO item = new MatchPredictionItemDTO();
        item.setMatchId(match.getId());
        item.setSign(sign);
        matchPredictionService.saveMatchdayPredictions(user.getGoogleEmail(), league.getId(), List.of(item));
    }

    private UserAccount user() {
        String email = "tenis-" + UUID.randomUUID() + "@test.invalid";
        return users.save(UserAccount.builder().googleEmail(email).googleName("Ana").participantName("Ana").build());
    }
}
