package app.porrapp;

import app.porrapp.config.DataInitializer;
import app.porrapp.dto.GrandPrixBoardDTO;
import app.porrapp.dto.GrandPrixPickRequest;
import app.porrapp.dto.MatchdayPointsDTO;
import app.porrapp.dto.ParticipantScoreDTO;
import app.porrapp.exception.BusinessException;
import app.porrapp.model.Competition;
import app.porrapp.model.Edition;
import app.porrapp.model.League;
import app.porrapp.model.Match;
import app.porrapp.model.MatchStatusNormalized;
import app.porrapp.model.PoolFormat;
import app.porrapp.model.PredictionLockMode;
import app.porrapp.model.RaceDriver;
import app.porrapp.model.UserAccount;
import app.porrapp.repository.CompetitionRepository;
import app.porrapp.repository.EditionRepository;
import app.porrapp.repository.MatchRepository;
import app.porrapp.repository.RaceDriverRepository;
import app.porrapp.repository.RaceWeekendRepository;
import app.porrapp.repository.UserAccountRepository;
import app.porrapp.scoring.ScoringRuleSet;
import app.porrapp.service.formulaone.FormulaOneSyncService;
import app.porrapp.service.formulaone.GrandPrixResultNotifier;
import app.porrapp.service.formulaone.GrandPrixService;
import app.porrapp.service.league.LeagueScoringService;
import app.porrapp.service.league.LeagueSetupService;
import app.porrapp.service.league.NewLeague;
import app.porrapp.service.prediction.LeaderboardService;
import app.porrapp.service.sync.SyncService;
import app.porrapp.service.tournament.CompetitionService;
import app.porrapp.service.tournament.TopScorerService;
import app.porrapp.sports.EspnFormulaOneClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.cache.CacheManager;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Fórmula 1 de principio a fin con Postgres real y respuestas de ESPN simuladas. */
@SpringBootTest
@TestPropertySource(locations = "file:src/main/resources/application.properties",
        properties = "app.jwt.secret=formula-one-test-secret-0123456789-abcdefghijk")
@Testcontainers(disabledWithoutDocker = true)
class FormulaOneIntegrationTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    @MockitoBean private DataInitializer dataInitializer;
    @MockitoBean private TopScorerService topScorerService;
    @MockitoBean private SyncService syncService;
    @MockitoBean private EspnFormulaOneClient espn;
    @MockitoBean private GrandPrixResultNotifier resultNotifier;
    @Autowired private RaceWeekendRepository raceWeekends;

    @Autowired private FormulaOneSyncService formulaOneSyncService;
    @Autowired private GrandPrixService grandPrixService;
    @Autowired private LeagueSetupService leagueSetupService;
    @Autowired private LeagueScoringService leagueScoringService;
    @Autowired private LeaderboardService leaderboardService;
    @Autowired private CompetitionService competitionService;
    @Autowired private CompetitionRepository competitions;
    @Autowired private EditionRepository editions;
    @Autowired private MatchRepository matches;
    @Autowired private RaceDriverRepository drivers;
    @Autowired private UserAccountRepository users;
    @Autowired private CacheManager cacheManager;

    private final ObjectMapper json = new ObjectMapper();
    private final Instant now = Instant.now().truncatedTo(ChronoUnit.MINUTES);
    private Competition f1;
    private String eventId;

    @BeforeEach
    void setUp() throws Exception {
        f1 = competitions.findByExternalId(Competition.FORMULA_ONE_EXTERNAL_ID).orElseThrow();
        eventId = String.valueOf(600_000_000L + (long) (Math.random() * 1_000_000));
        when(espn.isAvailable()).thenReturn(true);
        when(espn.sessionCompetitors(anyString(), anyString())).thenReturn(json.readTree("[]"));
        when(espn.seasonEvents(anyInt())).thenReturn(json.readTree("[]"));
        cacheManager.getCacheNames().forEach(name -> cacheManager.getCache(name).clear());
    }

    @Test
    void retriesResultNotificationWithoutAChangedPodium() throws Exception {
        when(espn.currentEvents()).thenReturn(events(true));
        when(resultNotifier.notifyResult(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any()))
                .thenThrow(new IllegalStateException("Temporary push failure")).thenReturn(1);

        formulaOneSyncService.syncCurrent(f1);
        Match gp = matches.findByExternalId("f1:" + eventId).orElseThrow();
        assertThat(raceWeekends.findById(gp.getId()).orElseThrow().getResultsNotifiedAt()).isNull();

        formulaOneSyncService.syncCurrent(f1);
        assertThat(raceWeekends.findById(gp.getId()).orElseThrow().getResultsNotifiedAt()).isNotNull();
        verify(resultNotifier, org.mockito.Mockito.times(2))
                .notifyResult(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
    }

    @Test
    @DisplayName("ESPN carga el Gran Premio, se predice hasta la clasificación y al acabar la carrera se puntúa")
    void grandPrixLifecycle() throws Exception {
        when(espn.currentEvents()).thenReturn(events(false));
        formulaOneSyncService.syncCurrent(f1);

        Match gp = matches.findByExternalId("f1:" + eventId).orElseThrow();
        assertThat(gp.getRound()).isEqualTo("GP de São Paulo");
        assertThat(gp.getMatchDate()).isEqualTo(now.plus(2, ChronoUnit.DAYS));
        assertThat(gp.getStatus()).isEqualTo(MatchStatusNormalized.SCHEDULED);
        assertThat(gp.getHomeTeam()).isNull();
        Map<String, Long> driver = drivers.findAll().stream()
                .collect(Collectors.toMap(RaceDriver::getExternalId, RaceDriver::getId, (a, b) -> a));

        assertThat(competitionService.findSyncableCompetitions())
                .filteredOn(c -> Competition.FORMULA_ONE_EXTERNAL_ID.equals(c.externalId()))
                .singleElement()
                .satisfies(c -> {
                    assertThat(c.sport()).isEqualTo(app.porrapp.model.Sport.FORMULA_1);
                    assertThat(c.finished()).isFalse();
                });

        UserAccount admin = user("Ana");
        League league = leagueSetupService.create(NewLeague.of("Paddock", admin.getGoogleEmail(), f1.getId(),
                PoolFormat.GRAND_PRIX), null);
        Edition edition = editions.findByLeagueIdAndStatus(league.getId(), "ACTIVE").orElseThrow();
        assertThat(edition.getLockMode()).isEqualTo(PredictionLockMode.PER_MATCH);
        // Sin pichichi: en la Fórmula 1 no hay goleadores.
        assertThat(edition.isPichichi()).isFalse();

        GrandPrixBoardDTO board = grandPrixService.board(admin.getGoogleEmail(), league.getId());
        GrandPrixBoardDTO.GrandPrix entry = find(board, gp);
        assertThat(entry.locked()).isFalse();
        assertThat(entry.gridIds()).hasSize(4);
        assertThat(board.rules()).isEqualTo(new GrandPrixBoardDTO.Rules(10, 4, 5, 3));

        Long norris = driver.get("1"), russell = driver.get("2"), antonelli = driver.get("3"), leclerc = driver.get("4");
        assertThatThrownBy(() -> grandPrixService.savePick(admin.getGoogleEmail(), league.getId(), gp.getId(),
                new GrandPrixPickRequest(norris, norris, antonelli, norris, null)))
                .isInstanceOf(BusinessException.class).hasMessageContaining("dos puestos");
        grandPrixService.savePick(admin.getGoogleEmail(), league.getId(), gp.getId(),
                new GrandPrixPickRequest(norris, russell, antonelli, norris, russell));

        // Sábado y domingo: clasificación con Norris en la pole y carrera Norris, Antonelli, Russell.
        when(espn.currentEvents()).thenReturn(events(true));
        when(espn.fastestLapAthlete(anyString(), anyString(), anyList())).thenReturn("2");
        formulaOneSyncService.syncCurrent(f1);

        board = grandPrixService.board(admin.getGoogleEmail(), league.getId());
        entry = find(board, gp);
        assertThat(entry.locked()).isTrue();
        assertThat(entry.status()).isEqualTo("FINISHED");
        assertThat(entry.result()).isEqualTo(new GrandPrixBoardDTO.Picks(norris, antonelli, russell, norris, russell));
        // Norris 1.º (10) + Russell y Antonelli en el podio (4 + 4) + pole (5) + vuelta rápida (3).
        assertThat(entry.points()).isEqualTo(26);
        assertThat(entry.details()).startsWith("GP de São Paulo: L. Norris 1.º (+10)");

        List<ParticipantScoreDTO> table = leaderboardService.getLeaderboard(league.getId());
        assertThat(table).singleElement().satisfies(row -> assertThat(row.getTotal()).isEqualTo(26));
        assertThat(leaderboardService.getMatchdayBreakdown(league.getId()))
                .filteredOn(day -> day.getLabel().equals("GP de São Paulo"))
                .singleElement()
                .extracting(MatchdayPointsDTO::getPointsByPrediction)
                .satisfies(points -> assertThat(points.values()).containsExactly(26));

        assertThatThrownBy(() -> grandPrixService.savePick(admin.getGoogleEmail(), league.getId(), gp.getId(),
                new GrandPrixPickRequest(leclerc, russell, antonelli, norris, null)))
                .isInstanceOf(BusinessException.class).hasMessageContaining("cerrada");
        assertThat(grandPrixService.memberPicks(admin.getGoogleEmail(), league.getId(), gp.getId()))
                .singleElement().satisfies(pick -> assertThat(pick.points()).isEqualTo(26));

        // El administrador cambia la puntuación: la pole pasa a valer 10.
        ScoringRuleSet rules = ScoringRuleSet.forEdition(edition);
        rules.setF1PolePoints(10);
        leagueScoringService.updateScoring(league.getId(), rules, admin.getGoogleEmail());
        assertThat(find(grandPrixService.board(admin.getGoogleEmail(), league.getId()), gp).points()).isEqualTo(31);
        assertThat(leaderboardService.getLeaderboard(league.getId()).get(0).getTotal()).isEqualTo(31);
    }

    @Test
    @DisplayName("Si falla la carga de la temporada al crear la liga, la siguiente pasada trae los Grandes Premios que quedan")
    void seasonImportRetriedAfterFailedLeagueImport() throws Exception {
        JsonNode season;
        try (var input = getClass().getResourceAsStream("/espn/f1/season-2026.json")) {
            season = json.readTree(input).path("events");
        }
        JsonNode saoPaulo = null;
        for (JsonNode event : season) {
            if (event.path("name").asText().contains("Paulo")) saoPaulo = event;
        }
        // Como en producción: la sincronización de cada 15 minutos solo ha guardado el Gran Premio en curso.
        when(espn.currentEvents()).thenReturn(json.createArrayNode().add(saoPaulo));
        formulaOneSyncService.syncCurrent(f1);

        // ESPN falla justo al crear la liga: la carga de la temporada (en segundo plano) no guarda nada.
        doThrow(new java.io.IOException("ESPN API returned HTTP 503")).when(espn).seasonEvents(anyInt());
        UserAccount admin = user("Marta");
        League league = leagueSetupService.create(NewLeague.of("Boxes", admin.getGoogleEmail(), f1.getId(),
                PoolFormat.GRAND_PRIX), null);
        verify(espn, timeout(10_000).atLeastOnce()).seasonEvents(anyInt());
        assertThatThrownBy(() -> formulaOneSyncService.importSeason(f1)).isInstanceOf(java.io.IOException.class);
        assertThat(grandPrixService.board(admin.getGoogleEmail(), league.getId()).grandsPrix())
                .extracting(GrandPrixBoardDTO.GrandPrix::name)
                .doesNotContain("GP de Las Vegas");

        // ESPN vuelve: la siguiente pasada periódica carga la temporada que faltaba.
        doReturn(season).when(espn).seasonEvents(anyInt());
        formulaOneSyncService.sync(f1);

        GrandPrixBoardDTO board = grandPrixService.board(admin.getGoogleEmail(), league.getId());
        assertThat(board.grandsPrix()).hasSizeGreaterThanOrEqualTo(season.size());
        assertThat(board.grandsPrix()).extracting(GrandPrixBoardDTO.GrandPrix::name)
                .contains("GP de Australia", "GP de São Paulo", "GP de Las Vegas", "GP de Catar", "GP de Abu Dabi");
        assertThat(board.grandsPrix()).filteredOn(gp -> gp.name().equals("GP de Australia")).singleElement()
                .satisfies(gp -> {
                    assertThat(gp.status()).isEqualTo("FINISHED");
                    assertThat(gp.result().first()).isNotNull();
                });

        // Los que quedan se pueden predecir con la parrilla del último Gran Premio.
        GrandPrixBoardDTO.GrandPrix abuDhabi = board.grandsPrix().stream()
                .filter(gp -> gp.name().equals("GP de Abu Dabi")).findFirst().orElseThrow();
        if (!abuDhabi.locked()) {
            List<Long> grid = abuDhabi.gridIds();
            assertThat(grid).hasSizeGreaterThanOrEqualTo(3);
            grandPrixService.savePick(admin.getGoogleEmail(), league.getId(), abuDhabi.id(),
                    new GrandPrixPickRequest(grid.get(0), grid.get(1), grid.get(2), grid.get(0), grid.get(1)));
            assertThat(find(grandPrixService.board(admin.getGoogleEmail(), league.getId()), abuDhabi.id()).pick())
                    .isEqualTo(new GrandPrixBoardDTO.Picks(grid.get(0), grid.get(1), grid.get(2), grid.get(0), grid.get(1)));
        }

        // Con la temporada ya cargada, la pasada siguiente vuelve a ser una sola consulta.
        clearInvocations(espn);
        formulaOneSyncService.sync(f1);
        verify(espn).currentEvents();
        verify(espn, never()).seasonEvents(anyInt());
    }

    @Test
    @DisplayName("La Fórmula 1 solo se juega por Grandes Premios, y ese modo solo existe en la Fórmula 1")
    void formatMatchesSport() {
        UserAccount admin = user("Luis");
        Competition football = competitions.save(Competition.builder().name("Liga " + eventId)
                .externalId("gp." + eventId).build());

        assertThatThrownBy(() -> leagueSetupService.create(NewLeague.of("Mal", admin.getGoogleEmail(), f1.getId(),
                PoolFormat.MATCH_DAY), null)).isInstanceOf(BusinessException.class)
                .hasMessageContaining("Gran Premio a Gran Premio");
        assertThatThrownBy(() -> leagueSetupService.create(NewLeague.of("Mal", admin.getGoogleEmail(), football.getId(),
                PoolFormat.GRAND_PRIX), null)).isInstanceOf(BusinessException.class)
                .hasMessageContaining("solo para la Fórmula 1");
        assertThatThrownBy(() -> leagueSetupService.create(NewLeague.custom("Mal", admin.getGoogleEmail(), "Karting",
                PoolFormat.GRAND_PRIX), null)).isInstanceOf(BusinessException.class);
    }

    private GrandPrixBoardDTO.GrandPrix find(GrandPrixBoardDTO board, Match gp) {
        return find(board, gp.getId());
    }

    private GrandPrixBoardDTO.GrandPrix find(GrandPrixBoardDTO board, Long id) {
        return board.grandsPrix().stream().filter(item -> item.id().equals(id)).findFirst().orElseThrow();
    }

    /** Un Gran Premio como lo da ESPN: clasificación en dos días y carrera en tres, o ya disputadas. */
    private JsonNode events(boolean raced) throws Exception {
        Instant qualifying = now.plus(2, ChronoUnit.DAYS);
        Instant race = now.plus(3, ChronoUnit.DAYS);
        String qualifyingOrder = raced ? "1,2,3,4" : null;
        String raceOrder = raced ? "1,3,2,4" : null;
        String event = """
                {"id": "%s", "name": "MSC Cruises São Paulo Grand Prix",
                 "circuit": {"fullName": "Autodromo Jose Carlos Pace", "address": {"city": "Sao Paulo", "country": "Brazil"}},
                 "competitions": [
                   {"id": "11", "date": "%s", "type": {"abbreviation": "FP1"}, "status": {"type": {"state": "post", "completed": true, "name": "STATUS_FINAL"}}, "competitors": []},
                   {"id": "12", "date": "%s", "type": {"abbreviation": "Qual"}, "status": %s, "competitors": %s},
                   {"id": "13", "date": "%s", "type": {"abbreviation": "Race"}, "status": %s, "competitors": %s}
                 ]}
                """.formatted(eventId, iso(qualifying.minus(1, ChronoUnit.DAYS)),
                iso(qualifying), status(raced), competitors(qualifyingOrder),
                iso(race), status(raced), competitors(raceOrder));
        return json.readTree("[" + event + "]");
    }

    private static String status(boolean done) {
        return done ? "{\"type\": {\"state\": \"post\", \"completed\": true, \"name\": \"STATUS_FINAL\"}}"
                : "{\"type\": {\"state\": \"pre\", \"completed\": false, \"name\": \"STATUS_SCHEDULED\"}}";
    }

    /** Cuatro pilotos; con {@code order} ("1,3,2,4") cada uno lleva su puesto. */
    private static String competitors(String order) {
        String[][] names = {{"1", "Lando Norris", "L. Norris"}, {"2", "George Russell", "G. Russell"},
                {"3", "Kimi Antonelli", "K. Antonelli"}, {"4", "Charles Leclerc", "C. Leclerc"}};
        List<String> positions = order == null ? null : List.of(order.split(","));
        StringBuilder out = new StringBuilder("[");
        for (int i = 0; i < names.length; i++) {
            String id = names[i][0];
            if (i > 0) out.append(',');
            out.append("{\"id\": \"").append(id).append("\", ");
            if (positions != null) out.append("\"order\": ").append(positions.indexOf(id) + 1).append(", ");
            out.append("\"athlete\": {\"displayName\": \"").append(names[i][1]).append("\", \"shortName\": \"")
                    .append(names[i][2]).append("\", \"flag\": {\"alt\": \"Britain\", \"href\": \"https://a.espncdn.com/x.png\"}}}");
        }
        return out.append(']').toString();
    }

    private static String iso(Instant instant) {
        return instant.toString().replace(":00Z", "Z");
    }

    private UserAccount user(String name) {
        String email = name.toLowerCase() + "-" + UUID.randomUUID() + "@test.local";
        return users.save(UserAccount.builder().googleEmail(email).googleName(name).participantName(name).build());
    }
}
