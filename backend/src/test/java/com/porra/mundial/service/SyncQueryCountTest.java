package com.porra.mundial.service;

import com.porra.mundial.config.DataInitializer;
import com.porra.mundial.model.Competition;
import com.porra.mundial.model.Edition;
import com.porra.mundial.model.GroupStanding;
import com.porra.mundial.model.League;
import com.porra.mundial.model.Match;
import com.porra.mundial.model.MatchPrediction;
import com.porra.mundial.model.Membership;
import com.porra.mundial.model.PoolFormat;
import com.porra.mundial.model.Prediction;
import com.porra.mundial.model.Team;
import com.porra.mundial.model.UserAccount;
import com.porra.mundial.repository.CompetitionRepository;
import com.porra.mundial.repository.EditionRepository;
import com.porra.mundial.repository.LeagueRepository;
import com.porra.mundial.repository.MatchPredictionRepository;
import com.porra.mundial.repository.MatchRepository;
import com.porra.mundial.repository.MembershipRepository;
import com.porra.mundial.repository.PredictionRepository;
import com.porra.mundial.repository.TeamRepository;
import com.porra.mundial.repository.UserAccountRepository;
import com.porra.mundial.sports.SportsDataProvider;
import com.porra.mundial.sports.SportsDataProviderRegistry;
import jakarta.persistence.EntityManagerFactory;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

/**
 * Cuenta las consultas SQL de una pasada de sincronización y de la petición de jornadas contra
 * Postgres real y con el application.properties de producción, con un proveedor deportivo falso:
 * 72 partidos de grupos y 4 de eliminatorias del Mundial y una jornada de LaLiga.
 */
@SpringBootTest
@TestPropertySource(locations = "file:src/main/resources/application.properties", properties = {
        "app.jwt.secret=query-count-test-secret-0123456789-abcdefghijklmnop",
        "spring.jpa.properties.hibernate.generate_statistics=true",
        "app.sync.interval-ms=3600000"})
@Testcontainers(disabledWithoutDocker = true)
class SyncQueryCountTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final ZoneId SPAIN = ZoneId.of("Europe/Madrid");
    private static final String TODAY = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));

    /** Sin la sincronización inicial ni los goleadores, que llamarían a ESPN. */
    @MockitoBean
    private DataInitializer dataInitializer;
    @MockitoBean
    private TopScorerService topScorerService;
    @MockitoBean
    private SportsDataProviderRegistry providerRegistry;

    @Autowired private SyncService syncService;
    @Autowired private MatchPredictionService matchPredictionService;
    @Autowired private CompetitionRepository competitionRepository;
    @Autowired private TeamRepository teamRepository;
    @Autowired private MatchRepository matchRepository;
    @Autowired private UserAccountRepository userAccountRepository;
    @Autowired private LeagueRepository leagueRepository;
    @Autowired private EditionRepository editionRepository;
    @Autowired private MembershipRepository membershipRepository;
    @Autowired private PredictionRepository predictionRepository;
    @Autowired private MatchPredictionRepository matchPredictionRepository;
    @Autowired private EntityManagerFactory entityManagerFactory;

    /** Eventos que devuelve el proveedor falso, por competición. */
    private final Map<String, List<ObjectNode>> events = new ConcurrentHashMap<>();
    private Statistics statistics;

    @BeforeEach
    void setUp() throws Exception {
        statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        SportsDataProvider provider = org.mockito.Mockito.mock(SportsDataProvider.class);
        when(provider.getProviderName()).thenReturn("fake");
        when(provider.isAvailable()).thenReturn(true);
        when(provider.fetchScoreboardEvents(anyString(), anyString())).thenAnswer(inv -> {
            String slug = inv.getArgument(0);
            String range = inv.getArgument(1);
            ArrayNode array = JSON.createArrayNode();
            boolean wanted = Competition.WORLD_CUP_EXTERNAL_ID.equals(slug) || TODAY.equals(range);
            if (wanted) events.getOrDefault(slug, List.of()).forEach(array::add);
            return array;
        });
        when(providerRegistry.getProviderForCompetition(anyString())).thenReturn(provider);
    }

    private record Measure(long statements, long matchLoads, long standingLoads) {
        @Override
        public String toString() {
            return statements + " sentencias SQL, " + matchLoads + " partidos cargados, "
                    + standingLoads + " filas de clasificación cargadas";
        }
    }

    private Measure measure(Runnable action) {
        statistics.clear();
        action.run();
        return new Measure(statistics.getPrepareStatementCount(),
                statistics.getEntityStatistics(Match.class.getName()).getLoadCount(),
                statistics.getEntityStatistics(GroupStanding.class.getName()).getLoadCount());
    }

    @Test
    void countsTheQueriesOfASyncPassAndOfAMatchdayRequest() throws Exception {
        List<Team> worldCupTeams = seedWorldCupTeams();
        events.put(Competition.WORLD_CUP_EXTERNAL_ID, worldCupEvents(worldCupTeams));
        Competition laLiga = competitionRepository.findByExternalId("esp.1").orElseThrow();
        List<Match> jornada1 = matchRepository.findByCompetitionIdOrderByMatchDateAsc(laLiga.getId()).stream()
                .filter(m -> "Jornada 1".equals(m.getRound()))
                .toList();
        events.put("esp.1", new ArrayList<>(jornada1.stream().map(SyncQueryCountTest::leagueEvent).toList()));

        Measure firstPass = measure(syncService::syncAll);
        Measure unchanged = measure(syncService::syncAll);

        events.get("esp.1").set(0, withScore(events.get("esp.1").get(0), 5, 5));
        Measure leagueResult = measure(syncService::syncAll);

        List<ObjectNode> worldCup = events.get(Competition.WORLD_CUP_EXTERNAL_ID);
        worldCup.set(0, withScore(worldCup.get(0), 4, 4));
        Measure worldCupResult = measure(syncService::syncAll);

        String email = "jornadas@test.com";
        League league = seedMatchdayLeague(email, laLiga);
        Measure matchday = measure(() -> matchPredictionService.getMatchdayFixtures(email, league.getId(), "Jornada 3"));
        Measure season = measure(() -> matchPredictionService.getMatchdayFixtures(email, league.getId(), null));

        System.out.println("[SQL] Primera pasada (crea los partidos del Mundial): " + firstPass);
        System.out.println("[SQL] Pasada sin cambios: " + unchanged);
        System.out.println("[SQL] Pasada con un resultado de LaLiga: " + leagueResult);
        System.out.println("[SQL] Pasada con un resultado del Mundial: " + worldCupResult);
        System.out.println("[SQL] Jornada 3 de LaLiga: " + matchday);
        System.out.println("[SQL] Temporada entera de LaLiga: " + season);

        // Solo una pasada que cambia un resultado del Mundial toca su clasificación, y una sola vez.
        assertThat(unchanged.standingLoads()).isZero();
        assertThat(leagueResult.standingLoads()).isZero();
        assertThat(worldCupResult.standingLoads()).isEqualTo(48);
        // La jornada solo carga sus partidos, no la temporada.
        assertThat(matchday.matchLoads()).isLessThan(season.matchLoads());
        assertThat(matchday.statements()).isLessThan(season.statements());
    }

    private List<Team> seedWorldCupTeams() {
        List<Team> teams = new ArrayList<>();
        for (char group = 'A'; group <= 'L'; group++) {
            for (int i = 1; i <= 4; i++) {
                String name = "Selección " + group + i;
                teams.add(teamRepository.save(Team.builder().name(name).nameEn(name).externalId("wc-" + group + i)
                        .groupName(String.valueOf(group)).build()));
            }
        }
        return teams;
    }

    private static List<ObjectNode> worldCupEvents(List<Team> teams) {
        List<ObjectNode> list = new ArrayList<>();
        int id = 0;
        LocalDateTime day = LocalDateTime.of(2026, 6, 11, 18, 0);
        int[][] pairs = {{0, 1}, {2, 3}, {0, 2}, {1, 3}, {0, 3}, {1, 2}};
        for (int g = 0; g < 12; g++) {
            String group = String.valueOf((char) ('A' + g));
            for (int[] pair : pairs) {
                Team home = teams.get(g * 4 + pair[0]);
                Team away = teams.get(g * 4 + pair[1]);
                list.add(event("wc-" + (++id), day.plusHours(id), "group-stage", "Group " + group,
                        home, away, id % 3, id % 2, true));
            }
        }
        list.add(event("wc-sf1", day.plusDays(30), "semifinals", "", teams.get(0), teams.get(4), 2, 1, true));
        list.add(event("wc-sf2", day.plusDays(31), "semifinals", "", teams.get(8), teams.get(12), 0, 1, true));
        list.add(event("wc-3rd", day.plusDays(34), "3rd-place-match", "", teams.get(4), teams.get(8), null, null, false));
        list.add(event("wc-final", day.plusDays(35), "final", "", teams.get(0), teams.get(12), null, null, false));
        return list;
    }

    private static ObjectNode leagueEvent(Match match) {
        return event(match.getExternalId(), match.getMatchDate(), "", "", match.getHomeTeam(), match.getAwayTeam(),
                match.getHomeScore(), match.getAwayScore(), Boolean.TRUE.equals(match.getFinished()));
    }

    private static ObjectNode event(String id, LocalDateTime date, String seasonSlug, String note, Team home,
                                    Team away, Integer homeScore, Integer awayScore, boolean finished) {
        ObjectNode event = JSON.createObjectNode();
        event.put("id", id);
        event.put("date", date.atZone(SPAIN).toOffsetDateTime().toString());
        event.putObject("season").put("slug", seasonSlug);
        ObjectNode competition = event.putArray("competitions").addObject();
        competition.put("altGameNote", note);
        ObjectNode type = competition.putObject("status").putObject("type");
        type.put("state", finished ? "post" : "pre");
        type.put("completed", finished);
        ArrayNode competitors = competition.putArray("competitors");
        competitor(competitors, "home", home, homeScore);
        competitor(competitors, "away", away, awayScore);
        return event;
    }

    private static void competitor(ArrayNode competitors, String side, Team team, Integer score) {
        ObjectNode node = competitors.addObject();
        node.put("homeAway", side);
        node.putObject("team").put("displayName", team.getName())
                .put("id", team.getExternalId() != null ? team.getExternalId() : "team-" + team.getId());
        if (score != null) node.put("score", String.valueOf(score));
    }

    private static ObjectNode withScore(ObjectNode event, int home, int away) {
        ObjectNode copy = event.deepCopy();
        JsonNode competitors = copy.path("competitions").get(0).path("competitors");
        ((ObjectNode) competitors.get(0)).put("score", String.valueOf(home));
        ((ObjectNode) competitors.get(1)).put("score", String.valueOf(away));
        return copy;
    }

    private League seedMatchdayLeague(String email, Competition laLiga) {
        UserAccount user = userAccountRepository.save(UserAccount.builder().googleEmail(email).googleName(email)
                .participantName("Jornadas").build());
        League league = leagueRepository.save(League.builder().name("Liga de jornadas").joinCode("JORNAD")
                .adminUser(user).build());
        Edition edition = editionRepository.save(Edition.builder().league(league).competition(laLiga)
                .poolFormat(PoolFormat.MATCH_DAY).build());
        membershipRepository.save(Membership.builder().id(new Membership.MembershipId(user.getId(), league.getId()))
                .user(user).league(league).role("ADMIN").build());
        Prediction prediction = predictionRepository.save(Prediction.builder().user(user).edition(edition)
                .name("Jornadas").build());
        // Pronósticos de toda la temporada importada, como un usuario que lleva jugando desde la jornada 1.
        matchRepository.findByCompetitionIdOrderByMatchDateAsc(laLiga.getId()).forEach(match ->
                matchPredictionRepository.save(MatchPrediction.builder().prediction(prediction).match(match)
                        .homeScore(1).awayScore(0).predictionSign("1").build()));
        return league;
    }
}
