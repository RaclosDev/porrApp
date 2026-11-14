package app.porrapp.service.sync;

import app.porrapp.config.DataInitializer;
import app.porrapp.config.InitialSyncExecutor;
import app.porrapp.model.Competition;
import app.porrapp.model.CompetitionTeam;
import app.porrapp.model.GroupStanding;
import app.porrapp.model.Match;
import app.porrapp.model.Team;
import app.porrapp.repository.CompetitionRepository;
import app.porrapp.repository.CompetitionTeamRepository;
import app.porrapp.repository.GroupStandingRepository;
import app.porrapp.repository.MatchRepository;
import app.porrapp.repository.TeamRepository;
import app.porrapp.service.tournament.TopScorerService;
import app.porrapp.sports.SportsDataProvider;
import app.porrapp.sports.SportsDataProviderRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.core.io.ClassPathResource;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.InputStream;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.TreeMap;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Una instalación desde cero (base vacía, migraciones y siembra reales) con lo que ESPN publica de verdad,
 * guardado en {@code src/test/resources/espn}: el Mundial 2026 queda como en producción y la Eurocopa 2024
 * de prueba, un torneo ya jugado que el proveedor ya no da por vigente, se importa entera al arrancar.
 */
@SpringBootTest
@TestPropertySource(locations = "file:src/main/resources/application.properties", properties = {
        "app.jwt.secret=fresh-install-test-secret-0123456789-abcdefghijklmnop",
        "app.seed.past-tournaments=true",
        "app.sync.interval-ms=3600000"})
@Testcontainers(disabledWithoutDocker = true)
class FreshInstallTournamentImportTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withTmpFs(java.util.Map.of("/var/lib/postgresql/data", "rw"))
            .withCommand("postgres", "-c", "fsync=off", "-c", "synchronous_commit=off", "-c", "full_page_writes=off");

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final String EURO = "uefa.euro";

    /** El arranque no sincroniza por su cuenta: cada test lo pide con el proveedor ya preparado. */
    @MockitoBean
    private InitialSyncExecutor initialSync;
    /** Los goleadores llamarían a ESPN. */
    @MockitoBean
    private TopScorerService topScorerService;
    @MockitoBean
    private SportsDataProviderRegistry providerRegistry;

    @Autowired private DataInitializer initializer;
    @Autowired private CompetitionImportService importService;
    @Autowired private CompetitionRepository competitionRepository;
    @Autowired private CompetitionTeamRepository competitionTeamRepository;
    @Autowired private TeamRepository teamRepository;
    @Autowired private MatchRepository matchRepository;
    @Autowired private GroupStandingRepository standingRepository;

    private SportsDataProvider provider;

    @BeforeEach
    void theProviderAnswersWhatEspnPublishes() throws Exception {
        provider = mock(SportsDataProvider.class);
        when(provider.getProviderName()).thenReturn("ESPN grabado");
        when(provider.isAvailable()).thenReturn(true);
        when(provider.fetchTeams(anyString())).thenAnswer(call -> recorded(call.getArgument(0) + "-teams"));
        when(provider.fetchScoreboardEvents(anyString(), anyString())).thenReturn(JSON.createArrayNode());
        when(provider.fetchScoreboardEvents(Competition.WORLD_CUP_EXTERNAL_ID, "2026"))
                .thenReturn(recorded("fifa.world-2026-scoreboard"));
        when(provider.fetchScoreboardEvents(EURO, "2024")).thenReturn(recorded("uefa.euro-2024-scoreboard"));
        when(providerRegistry.findProviderForCompetition(anyString())).thenReturn(Optional.of(provider));
        doAnswer(call -> {
            call.<Runnable>getArgument(0).run();
            return null;
        }).when(initialSync).execute(any(Runnable.class));
    }

    @Test
    @DisplayName("El Mundial 2026 en una base vacía: 72 partidos de grupo, el tercer puesto en su ronda y los nombres de la siembra")
    void theWorldCupOnAnEmptyDatabaseEndsUpAsInProduction() throws Exception {
        Competition worldCup = competitionRepository.findByExternalId(Competition.WORLD_CUP_EXTERNAL_ID).orElseThrow();
        List<String> seeded = seededNames("seed/world-cup-2026-teams.json");
        long teamsBefore = teamRepository.count();

        var result = importService.importCompetitionData(worldCup.getId());

        assertThat(result.importedMatches()).isEqualTo(104);
        List<Match> matches = matchRepository.findByCompetitionId(worldCup.getId());
        assertThat(byRound(matches)).containsExactlyInAnyOrderEntriesOf(Map.of(
                "group", 72L, "r32", 16L, "r16", 8L, "qf", 4L, "sf", 2L, "third", 1L, "final", 1L));
        Map<String, Long> groupMatches = matches.stream().filter(match -> "group".equals(match.getRound()))
                .collect(Collectors.groupingBy(Match::getGroupName, TreeMap::new, Collectors.counting()));
        assertThat(groupMatches.keySet()).containsExactly("A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L");
        assertThat(groupMatches.values()).containsOnly(6L);
        assertThat(matches).filteredOn(match -> "third".equals(match.getRound()))
                .allSatisfy(match -> assertThat(match.getGroupName()).isNull());

        // Los equipos son los sembrados, con su nombre en español: la importación no crea ni renombra ninguno.
        List<Team> teams = competitionTeamRepository.findGroupTeams(worldCup.getId()).stream()
                .map(CompetitionTeam::getTeam).toList();
        assertThat(teams).extracting(Team::getName).containsExactlyInAnyOrderElementsOf(seeded);
        assertThat(teams).allSatisfy(team -> {
            assertThat(team.getExternalId()).isNotBlank();
            assertThat(team.getNameEn()).isNotBlank();
            assertThat(team.getLogoUrl()).isNotBlank();
        });
        assertThat(teamRepository.count()).isEqualTo(teamsBefore);
        assertThat(matches).allSatisfy(match -> {
            assertThat(seeded).contains(match.getHomeTeam().getName(), match.getAwayTeam().getName());
            assertThat(match.getFinished()).isTrue();
        });
        assertThat(standingRepository.findByCompetitionIdOrderByGroupNameAscPositionAsc(worldCup.getId())).hasSize(48);
        assertThat(competitionRepository.findById(worldCup.getId()).orElseThrow().getSeason()).isEqualTo("2026");
    }

    @Test
    @DisplayName("La Eurocopa 2024 de prueba se importa entera al arrancar, por la temporada de su formato y sin tocar otras competiciones")
    void aSeededPastTournamentLoadsAllItsMatchesAtStartup() throws Exception {
        Competition euro = competitionRepository.findByExternalId(EURO).orElseThrow();
        // El proveedor ya da por vigente otra edición: la fila sigue siendo la de 2024.
        when(provider.fetchSeasonWindow(EURO))
                .thenReturn(new SportsDataProvider.SeasonWindow("2028-06-01T04:00Z", "2028-07-31T03:59Z"));
        Map<Long, String> others = otherCompetitions(euro);

        initializer.startInitialSync();

        List<Match> matches = matchRepository.findByCompetitionId(euro.getId());
        assertThat(byRound(matches)).containsExactlyInAnyOrderEntriesOf(Map.of(
                "group", 36L, "r16", 8L, "qf", 4L, "sf", 2L, "final", 1L));
        assertThat(matches).allSatisfy(match -> {
            assertThat(match.getFinished()).isTrue();
            assertThat(Team.isPlaceholder(match.getHomeTeam()) || Team.isPlaceholder(match.getAwayTeam())).isFalse();
        });
        assertThat(matches).filteredOn(match -> "final".equals(match.getRound()))
                .singleElement().satisfies(match -> assertThat(match.getWinnerTeam().getName()).isEqualTo("España"));

        // La fase de grupos oficial: seis grupos de cuatro, con sus tres partidos jugados.
        List<GroupStanding> standings = standingRepository.findByCompetitionIdOrderByGroupNameAscPositionAsc(euro.getId());
        assertThat(standings).hasSize(24).allSatisfy(row -> assertThat(row.getMatchesPlayed()).isEqualTo(3));
        Map<String, Long> teamsByGroup = standings.stream()
                .collect(Collectors.groupingBy(GroupStanding::getGroupName, TreeMap::new, Collectors.counting()));
        assertThat(teamsByGroup.keySet()).containsExactly("A", "B", "C", "D", "E", "F");
        assertThat(teamsByGroup.values()).containsOnly(4L);

        // Su temporada es la de su formato, y ninguna otra fila cambia, se archiva ni recibe partidos.
        Competition stored = competitionRepository.findById(euro.getId()).orElseThrow();
        assertThat(stored.getSeason()).isEqualTo("2024");
        assertThat(stored.isArchived()).isFalse();
        assertThat(otherCompetitions(euro)).isEqualTo(others);
        verify(provider).fetchScoreboardEvents(EURO, "2024");
        verify(provider, never()).fetchSeasonWindow(EURO);

        // Con sus partidos guardados, el siguiente arranque no vuelve a pedirlo.
        initializer.startInitialSync();

        verify(provider, times(1)).fetchScoreboardEvents(EURO, "2024");
    }

    /** Las demás competiciones, con lo que un cambio de temporada o una importación ajena les tocaría. */
    private Map<Long, String> otherCompetitions(Competition except) {
        return competitionRepository.findAll().stream()
                .filter(competition -> !competition.getId().equals(except.getId()))
                .collect(Collectors.toMap(Competition::getId, competition -> competition.getExternalId()
                        + "|" + competition.getSeason() + "|" + competition.getArchivedAt()
                        + "|" + matchRepository.countByCompetitionId(competition.getId())));
    }

    private static Map<String, Long> byRound(List<Match> matches) {
        return matches.stream().collect(Collectors.groupingBy(Match::getRound, Collectors.counting()));
    }

    private static JsonNode recorded(String name) throws Exception {
        try (InputStream in = new ClassPathResource("espn/" + name + ".json").getInputStream()) {
            return JSON.readTree(in);
        }
    }

    private static List<String> seededNames(String seed) throws Exception {
        try (InputStream in = new ClassPathResource(seed).getInputStream()) {
            List<String> names = new java.util.ArrayList<>();
            JSON.readTree(in).forEach(team -> names.add(team.path("name").asText()));
            return names;
        }
    }
}
