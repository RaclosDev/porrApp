package com.porra.mundial;

import com.porra.mundial.config.DataInitializer;
import com.porra.mundial.dto.MatchPredictionItemDTO;
import com.porra.mundial.dto.MatchSelectionRequest;
import com.porra.mundial.dto.MatchdayFixturePredictionDTO;
import com.porra.mundial.dto.MatchdayPointsDTO;
import com.porra.mundial.dto.ParticipantScoreDTO;
import com.porra.mundial.exception.BusinessException;
import com.porra.mundial.model.Competition;
import com.porra.mundial.model.Fight;
import com.porra.mundial.model.FightMethod;
import com.porra.mundial.model.League;
import com.porra.mundial.model.Match;
import com.porra.mundial.model.MatchSelectionMode;
import com.porra.mundial.model.MatchStatusNormalized;
import com.porra.mundial.model.PoolFormat;
import com.porra.mundial.model.PredictionLockMode;
import com.porra.mundial.model.Team;
import com.porra.mundial.model.UserAccount;
import com.porra.mundial.repository.CompetitionRepository;
import com.porra.mundial.repository.FightRepository;
import com.porra.mundial.repository.MatchPredictionRepository;
import com.porra.mundial.repository.MatchRepository;
import com.porra.mundial.repository.UserAccountRepository;
import com.porra.mundial.service.league.LeagueSetup;
import com.porra.mundial.service.league.LeagueSetupService;
import com.porra.mundial.service.league.NewLeague;
import com.porra.mundial.service.notification.FightCardChangedEvent;
import com.porra.mundial.service.prediction.LeaderboardService;
import com.porra.mundial.service.prediction.MatchPredictionService;
import com.porra.mundial.service.sync.MatchEventProcessor;
import com.porra.mundial.service.sync.SyncService;
import com.porra.mundial.service.tournament.TopScorerService;
import com.porra.mundial.util.AppTime;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.event.ApplicationEvents;
import org.springframework.test.context.event.RecordApplicationEvents;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Veladas de la UFC de punta a punta (cartelera, predicciones, cambios y puntos), con Postgres real. */
@SpringBootTest
@TestPropertySource(locations = "file:src/main/resources/application.properties",
        properties = "app.jwt.secret=ufc-fight-card-test-secret-0123456789-abcdefghij")
@Testcontainers(disabledWithoutDocker = true)
@RecordApplicationEvents
class UfcFightCardIntegrationTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    @MockitoBean private DataInitializer dataInitializer;
    @MockitoBean private TopScorerService topScorerService;
    @MockitoBean private SyncService syncService;

    @Autowired private MatchEventProcessor processor;
    @Autowired private LeagueSetupService leagueSetupService;
    @Autowired private MatchPredictionService matchPredictionService;
    @Autowired private LeaderboardService leaderboardService;
    @Autowired private CompetitionRepository competitions;
    @Autowired private MatchRepository matches;
    @Autowired private FightRepository fights;
    @Autowired private MatchPredictionRepository matchPredictions;
    @Autowired private UserAccountRepository users;
    @Autowired private ApplicationEvents events;

    private final ObjectMapper mapper = new ObjectMapper();
    private final Instant saturday = Instant.now().plus(3, ChronoUnit.DAYS).truncatedTo(ChronoUnit.HOURS);
    private String key;
    private Competition ufc;

    /** Pelea de la cartelera tal como la da {@code UfcDataProvider}. */
    private record Bout(String id, String red, String blue, String segment, int order, int rounds) {}

    @BeforeEach
    void competition() {
        key = UUID.randomUUID().toString().substring(0, 8);
        // Prefijo mma. como la UFC real; el sufijo evita chocar con la de otros tests de la clase.
        ufc = competitions.save(Competition.builder().name("UFC " + key).externalId("mma.ufc-" + key)
                .formatType(Competition.EVENTS_FORMAT).build());
    }

    @Test
    @DisplayName("Una velada se carga, se predice, cambia la cartelera y puntúa ganador, método y asalto")
    void fullFightNight() {
        // Una velada de hace un mes, que una liga nueva no cubre.
        sync("old", "UFC 300: Pasado", saturday.minus(30, ChronoUnit.DAYS),
                List.of(new Bout("old1", "Antiguo Rojo", "Antiguo Azul", "main", 1, 5)), Map.of());

        Bout main = new Bout("m1", "Renato Moicano", "Tom Nolan", "main", 1, 5);
        Bout prelim = new Bout("p1", "Julian Erosa", "JeongYeong Lee", "prelims1", 2, 3);
        Bout early = new Bout("p2", "Piera Rodriguez", "Talita Alencar", "prelims2", 3, 3);
        String night = "UFC Fight Night: Moicano vs. Nolan";
        sync("e1", night, saturday, List.of(main, prelim, early), Map.of());

        Match mainMatch = matches.findByExternalId("ufc-m1").orElseThrow();
        assertThat(mainMatch.getRound()).isEqualTo(night);
        assertThat(mainMatch.getHomeTeam().getExternalId()).isEqualTo("ufc-am1-red");
        Fight mainFight = fights.findById(mainMatch.getId()).orElseThrow();
        assertThat(mainFight.getCardSegment()).isEqualTo("MAIN");
        assertThat(mainFight.getScheduledRounds()).isEqualTo(5);

        UserAccount ana = user();
        League league = create(ana, null);
        List<MatchdayFixturePredictionDTO> card = fixtures(ana, league);
        assertThat(card).extracting(MatchdayFixturePredictionDTO::getHomeTeam)
                .containsExactlyInAnyOrder("Renato Moicano", "Julian Erosa", "Piera Rodriguez");
        assertThat(card).allSatisfy(f -> assertThat(f.getFight()).isNotNull());
        assertThat(card).allSatisfy(f -> assertThat(f.getRound()).isEqualTo(night));

        // Validaciones de la predicción de una pelea.
        assertThatThrownBy(() -> predict(ana, league, "ufc-m1", "X", null, null))
                .isInstanceOf(BusinessException.class).hasMessageContaining("1 o 2");
        assertThatThrownBy(() -> predict(ana, league, "ufc-m1", "2", "DECISION", 2))
                .isInstanceOf(BusinessException.class).hasMessageContaining("KO/TKO o una sumisión");
        assertThatThrownBy(() -> predict(ana, league, "ufc-p1", "1", "KO_TKO", 4))
                .isInstanceOf(BusinessException.class).hasMessageContaining("3 asaltos");

        predict(ana, league, "ufc-m1", "2", "KO_TKO", 3);
        predict(ana, league, "ufc-p1", "1", "DECISION", null);
        predict(ana, league, "ufc-p2", "1", null, null);
        assertThat(fixtures(ana, league)).filteredOn(f -> f.getMatchId().equals(mainMatch.getId()))
                .singleElement().satisfies(f -> {
                    assertThat(f.getPredSign()).isEqualTo("2");
                    assertThat(f.getPredMethod()).isEqualTo("KO_TKO");
                    assertThat(f.getPredRound()).isEqualTo(3);
                });

        // Cambio de rival en la preliminar y la de los preliminares tempranos se cae.
        Bout newOpponent = new Bout("p1", "Julian Erosa", "Sustituto Nuevo", "prelims1", 2, 3);
        sync("e1", night, saturday, List.of(main, newOpponent), Map.of());

        Match prelimMatch = matches.findByExternalId("ufc-p1").orElseThrow();
        Match earlyMatch = matches.findByExternalId("ufc-p2").orElseThrow();
        assertThat(prelimMatch.getAwayTeam().getName()).isEqualTo("Sustituto Nuevo");
        assertThat(matchPredictions.findByMatchId(prelimMatch.getId())).isEmpty();
        assertThat(earlyMatch.getStatus()).isEqualTo(MatchStatusNormalized.CANCELLED);
        assertThat(matchPredictions.findByMatchId(earlyMatch.getId())).isEmpty();
        assertThat(matchPredictions.findByMatchId(mainMatch.getId())).hasSize(1);
        List<FightCardChangedEvent.Notice> notices = events.stream(FightCardChangedEvent.class)
                .flatMap(event -> event.notices().stream()).toList();
        assertThat(notices).extracting(FightCardChangedEvent.Notice::title)
                .containsExactlyInAnyOrder("Julian Erosa tiene nuevo rival", "Pelea cancelada");
        assertThat(notices).allSatisfy(n -> assertThat(n.userId()).isEqualTo(ana.getId()));
        assertThat(fixtures(ana, league)).filteredOn(f -> f.getMatchId().equals(earlyMatch.getId()))
                .singleElement().satisfies(f -> {
                    assertThat(f.isLocked()).isTrue();
                    assertThat(f.getLockReason()).isEqualTo("Pelea cancelada: no puntúa");
                });

        // Acaba la estelar: Nolan por KO/TKO en el tercer asalto.
        sync("e1", night, saturday, List.of(main, newOpponent), Map.of("m1", new String[]{"2", "kotko", "3"}));

        Fight result = fights.findById(mainMatch.getId()).orElseThrow();
        assertThat(result.getResultMethod()).isEqualTo(FightMethod.KO_TKO);
        assertThat(result.getResultRound()).isEqualTo(3);
        assertThat(matchPredictions.findByMatchId(mainMatch.getId())).singleElement().satisfies(mp -> {
            assertThat(mp.getPointsAwarded()).isEqualTo(7);
            assertThat(mp.getScoringDetails()).isEqualTo("Ganador +3 · Método +2 · Asalto +2 (7 pts)");
        });
        assertThat(leaderboardService.getLeaderboard(league.getId())).singleElement()
                .extracting(ParticipantScoreDTO::getTotal).isEqualTo(7);
        assertThat(leaderboardService.getMatchdayBreakdown(league.getId())).extracting(MatchdayPointsDTO::getLabel)
                .containsExactly(night);
    }

    @Test
    @DisplayName("Una liga de una sola velada suma sola las peleas que se añaden a su cartelera")
    void singleFightNightLeague() {
        Bout main = new Bout("s1", "Ciryl Gane", "Hokit", "main", 1, 5);
        Bout other = new Bout("s2", "Rojo Dos", "Azul Dos", "main", 2, 3);
        String night = "UFC 334: Gane vs. Hokit";
        sync("e2", night, saturday, List.of(main, other), Map.of());
        sync("e3", "UFC Fight Night: Otra", saturday.plus(7, ChronoUnit.DAYS),
                List.of(new Bout("o1", "Rojo Otra", "Azul Otra", "main", 1, 5)), Map.of());

        List<Long> fightNight = List.of(matches.findByExternalId("ufc-s1").orElseThrow().getId(),
                matches.findByExternalId("ufc-s2").orElseThrow().getId());
        UserAccount ana = user();
        League league = create(ana, new MatchSelectionRequest(MatchSelectionMode.CUSTOM, List.of(), fightNight, List.of()));
        assertThat(fixtures(ana, league)).extracting(MatchdayFixturePredictionDTO::getMatchId)
                .containsExactlyInAnyOrderElementsOf(fightNight);

        Bout added = new Bout("s3", "Nuevo Rojo", "Nuevo Azul", "prelims1", 3, 3);
        sync("e2", night, saturday, List.of(main, other, added), Map.of());

        Long addedId = matches.findByExternalId("ufc-s3").orElseThrow().getId();
        assertThat(fixtures(ana, league)).extracting(MatchdayFixturePredictionDTO::getMatchId)
                .containsExactlyInAnyOrder(fightNight.get(0), fightNight.get(1), addedId);
    }

    @Test
    @DisplayName("Una velada que cruza la medianoche del día en que se crea la liga entra entera")
    void fightNightAcrossMidnight() {
        // Estelar a la 1:00 de hoy (hora peninsular) y preliminares dos horas antes, aún ayer.
        Instant mainCard = AppTime.startOfDay(AppTime.day(Instant.now())).plus(1, ChronoUnit.HOURS);
        sync("e4", "UFC Fight Night: Medianoche", mainCard, List.of(
                new Bout("n1", "Rojo Estelar", "Azul Estelar", "main", 1, 5),
                new Bout("n2", "Rojo Previo", "Azul Previo", "prelims1", 2, 3)), Map.of());

        UserAccount ana = user();
        League league = create(ana, null);
        assertThat(fixtures(ana, league)).extracting(MatchdayFixturePredictionDTO::getHomeTeam)
                .containsExactlyInAnyOrder("Rojo Estelar", "Rojo Previo");
    }

    @Test
    @DisplayName("La UFC solo se juega por veladas")
    void onlyMatchdayLeagues() {
        UserAccount ana = user();
        assertThatThrownBy(() -> leagueSetupService.create(new NewLeague("Cuadro", ana.getGoogleEmail(), ufc.getId(),
                PoolFormat.FULL_BRACKET, false, null, null), LeagueSetup.NONE))
                .isInstanceOf(BusinessException.class).hasMessageContaining("velada a velada");
    }

    /**
     * Pasa una cartelera por el procesador como lo haría la sincronización.
     *
     * @param results id de pelea → {esquina ganadora, método de ESPN, asalto}
     */
    private void sync(String eventId, String eventName, Instant date, List<Bout> bouts, Map<String, String[]> results) {
        ArrayNode card = mapper.createArrayNode();
        for (Bout bout : bouts) {
            card.addObject().put("id", "ufc-" + bout.id())
                    .put("home", fighterId(bout, true)).put("away", fighterId(bout, false))
                    .put("homeName", bout.red()).put("awayName", bout.blue());
        }
        MatchEventProcessor.Batch batch = new MatchEventProcessor.Batch(ufc);
        Map<String, Team> cache = new HashMap<>();
        for (Bout bout : bouts) {
            processor.process(event(eventId, eventName, date, bout, card, results.get(bout.id())), cache, batch);
        }
    }

    private JsonNode event(String eventId, String eventName, Instant date, Bout bout, ArrayNode card, String[] result) {
        boolean finished = result != null;
        ObjectNode event = mapper.createObjectNode().put("id", "ufc-" + bout.id())
                .put("date", (bout.segment().equals("main") ? date : date.minus(2, ChronoUnit.HOURS)).toString());
        ObjectNode competition = event.putArray("competitions").addObject().put("id", "ufc-" + bout.id());
        competition.putObject("status").putObject("type")
                .put("name", finished ? "STATUS_FINAL" : "STATUS_SCHEDULED")
                .put("state", finished ? "post" : "pre").put("completed", finished);
        ArrayNode competitors = competition.putArray("competitors");
        for (boolean red : new boolean[]{true, false}) {
            ObjectNode competitor = competitors.addObject().put("homeAway", red ? "home" : "away");
            competitor.putObject("team").put("id", fighterId(bout, red)).put("displayName", red ? bout.red() : bout.blue());
            boolean wins = finished && result[0].equals(red ? "1" : "2");
            competitor.put("winner", wins);
            if (finished) competitor.put("score", wins ? "1" : "0");
        }
        ObjectNode ufcNode = event.putObject("ufc").put("eventId", eventId).put("eventName", eventName)
                .put("segment", bout.segment().equals("main") ? "MAIN"
                        : bout.segment().equals("prelims2") ? "EARLY_PRELIMS" : "PRELIMS")
                .put("order", bout.order()).put("rounds", bout.rounds())
                .put("weightClass", "Lightweight").put("homeRecord", "10-1-0").put("awayRecord", "9-2-0");
        if (finished) ufcNode.put("method", result[1]).put("round", Integer.parseInt(result[2])).put("clock", "1:28");
        ufcNode.set("card", card);
        return event;
    }

    /** El sustituto tiene otro id; el resto conserva el suyo entre pasadas. */
    private String fighterId(Bout bout, boolean red) {
        String name = red ? bout.red() : bout.blue();
        return "ufc-a" + bout.id() + (red ? "-red" : name.startsWith("Sustituto") ? "-sub" : "-blue");
    }

    private League create(UserAccount admin, MatchSelectionRequest selection) {
        return leagueSetupService.create(new NewLeague("Veladas " + key, admin.getGoogleEmail(), ufc.getId(),
                PoolFormat.MATCH_DAY, false, null, null),
                new LeagueSetup(null, null, null, PredictionLockMode.PER_ROUND, 0, null, selection));
    }

    private List<MatchdayFixturePredictionDTO> fixtures(UserAccount user, League league) {
        return new ArrayList<>(matchPredictionService.getMatchdayFixtures(user.getGoogleEmail(), league.getId(), null));
    }

    private void predict(UserAccount user, League league, String externalId, String sign, String method, Integer round) {
        MatchPredictionItemDTO item = new MatchPredictionItemDTO();
        item.setMatchId(matches.findByExternalId(externalId).orElseThrow().getId());
        item.setSign(sign);
        item.setMethod(method);
        item.setRound(round);
        matchPredictionService.saveMatchdayPredictions(user.getGoogleEmail(), league.getId(), List.of(item));
    }

    private UserAccount user() {
        String email = "ufc-" + UUID.randomUUID() + "@test.invalid";
        return users.save(UserAccount.builder().googleEmail(email).googleName("Ana").participantName("Ana").build());
    }
}
