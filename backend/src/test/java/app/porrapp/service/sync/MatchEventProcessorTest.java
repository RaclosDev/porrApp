package app.porrapp.service.sync;

import app.porrapp.service.tournament.TopScorerService;
import app.porrapp.service.prediction.MatchPredictionService;
import app.porrapp.service.notification.WebSocketService;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import app.porrapp.model.Competition;
import app.porrapp.model.Match;
import app.porrapp.model.MatchStatusNormalized;
import app.porrapp.model.Team;
import app.porrapp.repository.MatchRepository;
import app.porrapp.repository.TeamRepository;
import app.porrapp.util.AppTime;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MatchEventProcessorTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    @Mock private TeamRepository teamRepository;
    @Mock private MatchRepository matchRepository;
    @Mock private MatchPredictionService matchPredictionService;
    @Mock private TopScorerService topScorerService;
    @Mock private WebSocketService webSocketService;

    @InjectMocks
    private MatchEventProcessor processor;

    private Map<String, Team> cache;
    private Team spain;
    private Team uruguay;
    private final Competition worldCup = Competition.builder().id(2L).name("FIFA World Cup 2026")
            .externalId(Competition.WORLD_CUP_EXTERNAL_ID).formatType("TOURNAMENT").build();

    @BeforeEach
    void setUp() {
        spain = Team.builder().id(1L).name("España").nameEn("Spain").externalId("164").build();
        uruguay = Team.builder().id(2L).name("Uruguay").nameEn("Uruguay").externalId("212").build();
        cache = new HashMap<>(Map.of("España", spain, "Spain", spain, "164", spain,
                "Uruguay", uruguay, "212", uruguay));
    }

    private JsonNode event(String state, boolean completed, String note, String homeScore, String awayScore,
                           String homeName, String homeId, String awayName, String awayId, String details) throws Exception {
        return JSON.readTree("""
                {"id": "401", "date": "2026-06-15T19:00Z",
                 "competitions": [{
                   "altGameNote": "%s",
                   "status": {"displayClock": "90'", "type": {"state": "%s", "completed": %s}},
                   "competitors": [
                     {"homeAway": "home", "score": "%s", "team": {"displayName": "%s", "id": "%s"}},
                     {"homeAway": "away", "score": "%s", "team": {"displayName": "%s", "id": "%s"}}
                   ],
                   "details": %s
                 }]}
                """.formatted(note, state, completed, homeScore, homeName, homeId, awayScore, awayName, awayId, details));
    }

    private Match savedMatch() {
        ArgumentCaptor<Match> captor = ArgumentCaptor.forClass(Match.class);
        verify(matchRepository).save(captor.capture());
        return captor.getValue();
    }

    @Test
    @DisplayName("Una roja directa resta lo que diga el reglamento del torneo: 4 en el Mundial y 3 en la Eurocopa")
    void aDirectRedCardCostsWhatTheTournamentRulesSay() throws Exception {
        when(matchRepository.findByExternalId("401")).thenReturn(Optional.empty());
        Competition euro = Competition.builder().id(9L).name("UEFA Euro 2024").externalId("uefa.euro")
                .formatType("TOURNAMENT").build();
        String cards = """
                [{"yellowCard": true, "team": {"id": "164"}, "athletesInvolved": [{"id": "p1"}]},
                 {"yellowCard": true, "team": {"id": "164"}, "athletesInvolved": [{"id": "p1"}]},
                 {"redCard": true, "team": {"id": "212"}, "athletesInvolved": [{"id": "p9"}]}]
                """;

        processor.process(event("post", true, "Group H", "2", "1", "Spain", "164", "Uruguay", "212", cards), cache,
                new MatchEventProcessor.Batch(euro));

        Match match = savedMatch();
        assertEquals(-3, match.getHomeFairPlay(), "amarilla (-1) + segunda amarilla (-2)");
        assertEquals(-3, match.getAwayFairPlay(), "roja directa en la UEFA");
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.CsvSource({"STATUS_CANCELED,CANCELLED", "STATUS_POSTPONED,POSTPONED", "STATUS_SUSPENDED,SUSPENDED", "STATUS_ABANDONED,ABANDONED"})
    void preservesProviderInterruptionStatus(String external, MatchStatusNormalized expected) throws Exception {
        var event = event("pre", false, "Group H", "0", "0", "Spain", "164", "Uruguay", "212", "[]");
        ((tools.jackson.databind.node.ObjectNode) event.path("competitions").get(0).path("status").path("type"))
                .put("name", external);

        processor.process(event, cache, new MatchEventProcessor.Batch(worldCup));

        assertEquals(expected, savedMatch().getStatus());
        verify(matchPredictionService, never()).evaluatePredictionsForMatch(any());
    }

    @Test
    @DisplayName("Un partido de grupo terminado guarda marcador, grupo, fair play y evalúa pronósticos")
    void savesFinishedGroupMatch() throws Exception {
        when(matchRepository.findByExternalId("401")).thenReturn(Optional.empty());
        String cards = """
                [{"yellowCard": true, "team": {"id": "164"}, "athletesInvolved": [{"id": "p1"}]},
                 {"yellowCard": true, "team": {"id": "164"}, "athletesInvolved": [{"id": "p1"}]},
                 {"redCard": true, "team": {"id": "212"}, "athletesInvolved": [{"id": "p9"}]}]
                """;
        MatchEventProcessor.Batch batch = new MatchEventProcessor.Batch(worldCup);

        processor.process(event("post", true, "Group H", "2", "1", "Spain", "164", "Uruguay", "212", cards), cache, batch);

        Match match = savedMatch();
        assertSame(spain, match.getHomeTeam());
        assertSame(uruguay, match.getAwayTeam());
        assertEquals(2, match.getHomeScore());
        assertEquals(1, match.getAwayScore());
        assertEquals("H", match.getGroupName());
        assertEquals("group", match.getRound());
        assertTrue(match.getFinished());
        assertEquals(MatchStatusNormalized.FINISHED, match.getStatus());
        assertEquals(-3, match.getHomeFairPlay(), "amarilla (-1) + segunda amarilla (-2)");
        assertEquals(-4, match.getAwayFairPlay(), "roja directa");
        assertEquals(1, batch.matchesUpdated());
        verify(matchPredictionService).evaluatePredictionsForMatch(match);
        verify(topScorerService, never()).refresh(org.mockito.ArgumentMatchers.any());
        verify(webSocketService).broadcastMatchScore(any(), eq("España"), eq("Uruguay"), eq(2), eq(1), eq("FINISHED"));
    }

    @Test
    @DisplayName("Una serie del LoL guarda al mejor de cuántas partidas se juega")
    void savesTheBestOfOfALolSeries() throws Exception {
        when(matchRepository.findByExternalId("401")).thenReturn(Optional.empty());
        var event = event("pre", false, "Semifinals", "", "", "Spain", "164", "Uruguay", "212", "[]");
        ((tools.jackson.databind.node.ObjectNode) event.path("competitions").get(0)).put("bestOf", 5);

        processor.process(event, cache, new MatchEventProcessor.Batch(worldCup));

        assertEquals(5, savedMatch().getBestOf());
    }

    @Test
    @DisplayName("Asigna la ronda de eliminatoria a partir de las notas del evento")
    void parsesKnockoutRound() throws Exception {
        when(matchRepository.findByExternalId("401")).thenReturn(Optional.empty());

        processor.process(event("pre", false, "Round of 16", "", "", "Spain", "164", "Uruguay", "212", "[]"),
                cache, new MatchEventProcessor.Batch(worldCup));

        Match match = savedMatch();
        assertEquals("r16", match.getRound());
        assertNull(match.getHomeScore());
        assertFalse(match.getFinished());
        verifyNoInteractions(matchPredictionService);
    }

    @Test
    @DisplayName("El partido por el tercer puesto sale de season.slug, no como partido de grupo")
    void parsesThirdPlaceFromSeasonSlug() throws Exception {
        when(matchRepository.findByExternalId("401")).thenReturn(Optional.empty());
        JsonNode event = event("pre", false, "FIFA World Cup, 3rd-Place Match", "", "", "Spain", "164", "Uruguay", "212", "[]");
        ((tools.jackson.databind.node.ObjectNode) event).putObject("season").put("slug", "3rd-place-match");

        processor.process(event, cache, new MatchEventProcessor.Batch(worldCup));

        assertEquals("third", savedMatch().getRound());
    }

    @Test
    @DisplayName("Sin season.slug, la nota \"3rd-Place Match\" también se reconoce como tercer puesto")
    void parsesHyphenatedThirdPlaceNote() throws Exception {
        when(matchRepository.findByExternalId("401")).thenReturn(Optional.empty());

        processor.process(event("pre", false, "FIFA World Cup, 3rd-Place Match", "", "", "Spain", "164", "Uruguay", "212", "[]"),
                cache, new MatchEventProcessor.Batch(worldCup));

        assertEquals("third", savedMatch().getRound());
    }

    @Test
    @DisplayName("Cada season.slug de ESPN se traduce a su ronda")
    void mapsEverySeasonSlug() {
        assertEquals("playin", MatchEventProcessor.roundFromSlug("play-in"));
        assertEquals("group", MatchEventProcessor.roundFromSlug("group-stage"));
        assertEquals("r32", MatchEventProcessor.roundFromSlug("round-of-32"));
        assertEquals("r16", MatchEventProcessor.roundFromSlug("round-of-16"));
        assertEquals("qf", MatchEventProcessor.roundFromSlug("quarterfinals"));
        assertEquals("sf", MatchEventProcessor.roundFromSlug("semifinals"));
        assertEquals("third", MatchEventProcessor.roundFromSlug("3rd-place-match"));
        assertEquals("final", MatchEventProcessor.roundFromSlug("final"));
        assertEquals("playoff", MatchEventProcessor.roundFromSlug("knockout-round-playoffs"));
        assertEquals("round1", MatchEventProcessor.roundFromSlug("first-round"));
        assertEquals("round2", MatchEventProcessor.roundFromSlug("second-round"));
        assertEquals("qualifying", MatchEventProcessor.roundFromSlug("qualifying-round"));
        assertEquals("roundrobin", MatchEventProcessor.roundFromSlug("round-robin"));
        assertNull(MatchEventProcessor.roundFromSlug("league-phase"));
        assertNull(MatchEventProcessor.roundFromSlug(null));
    }

    @Test
    @DisplayName("Un tenista que aún no estaba guardado se crea con el partido, con su bandera")
    void createsATennisPlayerThatArrivesWithItsMatch() throws Exception {
        Competition paris = Competition.builder().id(7L).name("Masters de París").externalId("tennis.atp.13")
                .formatType("TOURNAMENT").build();
        when(teamRepository.findByName(anyString())).thenReturn(Optional.empty());
        when(teamRepository.save(any(Team.class))).thenAnswer(invocation -> invocation.getArgument(0));
        JsonNode event = JSON.readTree("""
                {"id": "tennis-186507", "date": "2026-11-08T14:00Z", "season": {"slug": "final"},
                 "competitions": [{"altGameNote": "", "status": {"type": {"name": "STATUS_SCHEDULED", "state": "pre", "completed": false}},
                   "competitors": [
                     {"homeAway": "home", "winner": false, "team": {"id": "tennis-1", "displayName": "Ben Shelton", "logo": "https://flags/usa.png"}},
                     {"homeAway": "away", "winner": false, "team": {"id": "tennis-2", "displayName": "Carlos Alcaraz", "logo": "https://flags/esp.png"}}]}]}
                """);

        processor.process(event, cache, new MatchEventProcessor.Batch(paris));

        Match saved = savedMatch();
        assertEquals("Ben Shelton", saved.getHomeTeam().getName());
        assertEquals("https://flags/esp.png", saved.getAwayTeam().getLogoUrl());
        assertEquals("tennis-2", saved.getAwayTeam().getExternalId());
        assertEquals("final", saved.getRound());
        assertSame(saved.getAwayTeam(), cache.get("tennis-2"));
    }

    @Test
    @DisplayName("Descarta huecos del calendario sin ningún equipo conocido")
    void skipsEventsWithoutKnownTeams() throws Exception {
        Team placeholder = Team.builder().id(99L).name(Team.PLACEHOLDER_NAME).nameEn(Team.PLACEHOLDER_NAME_EN).build();
        when(teamRepository.findByName(anyString())).thenReturn(Optional.empty());
        when(teamRepository.findByName(Team.PLACEHOLDER_NAME)).thenReturn(Optional.of(placeholder));

        processor.process(event("pre", false, "Final", "", "", "Winner SF1", "9001", "Winner SF2", "9002", "[]"),
                cache, new MatchEventProcessor.Batch(worldCup));

        verify(matchRepository, never()).save(any());
    }

    @Test
    @DisplayName("No guarda nada si el partido no ha cambiado")
    void doesNotSaveUnchangedMatch() throws Exception {
        JsonNode e = event("pre", false, "Group H", "", "", "Spain", "164", "Uruguay", "212", "[]");
        when(matchRepository.findByExternalId("401")).thenReturn(Optional.empty());
        processor.process(e, cache, new MatchEventProcessor.Batch(worldCup));
        Match stored = savedMatch();
        stored.setId(10L);

        reset(matchRepository);
        when(matchRepository.findByExternalId("401")).thenReturn(Optional.of(stored));
        MatchEventProcessor.Batch second = new MatchEventProcessor.Batch(worldCup);
        processor.process(e, cache, second);

        verify(matchRepository, never()).save(any());
        assertEquals(0, second.matchesUpdated());
    }

    @Test
    @DisplayName("Un gol en directo actualiza el ranking provisional; el final confirma el resultado")
    void flagsLiveAndFinalScoreChanges() throws Exception {
        when(matchRepository.findByExternalId("401")).thenReturn(Optional.empty());
        processor.process(event("in", false, "Round of 16", "1", "0", "Spain", "164", "Uruguay", "212", "[]"),
                cache, new MatchEventProcessor.Batch(worldCup));
        Match stored = savedMatch();
        stored.setId(10L);
        reset(matchRepository);
        when(matchRepository.findByExternalId("401")).thenReturn(Optional.of(stored));

        MatchEventProcessor.Batch goal = new MatchEventProcessor.Batch(worldCup);
        processor.process(event("in", false, "Round of 16", "2", "0", "Spain", "164", "Uruguay", "212", "[]"),
                cache, goal);
        assertEquals(1, goal.matchesUpdated());
        assertTrue(goal.resultsChanged());

        MatchEventProcessor.Batch fullTime = new MatchEventProcessor.Batch(worldCup);
        processor.process(event("post", true, "Round of 16", "2", "0", "Spain", "164", "Uruguay", "212", "[]"),
                cache, fullTime);
        assertTrue(fullTime.resultsChanged());
    }

    @Test
    @DisplayName("Los equipos cargados de nuevo con el partido no cuentan como cambio")
    void comparesTeamsById() throws Exception {
        JsonNode e = event("post", true, "Group H", "2", "1", "Spain", "164", "Uruguay", "212", "[]");
        when(matchRepository.findByExternalId("401")).thenReturn(Optional.empty());
        processor.process(e, cache, new MatchEventProcessor.Batch(worldCup));
        Match stored = savedMatch();
        stored.setId(10L);
        stored.setHomeTeam(Team.builder().id(spain.getId()).name(spain.getName()).build());
        stored.setAwayTeam(Team.builder().id(uruguay.getId()).name(uruguay.getName()).build());

        reset(matchRepository);
        when(matchRepository.findByExternalId("401")).thenReturn(Optional.of(stored));
        MatchEventProcessor.Batch second = new MatchEventProcessor.Batch(worldCup);
        processor.process(e, cache, second);

        verify(matchRepository, never()).save(any());
        assertFalse(second.resultsChanged());
    }

    /** Partido ya guardado y terminado con el marcador dado. */
    private Match storedFinishedMatch(String homeScore, String awayScore) throws Exception {
        when(matchRepository.findByExternalId("401")).thenReturn(Optional.empty());
        processor.process(event("post", true, "Group H", homeScore, awayScore, "Spain", "164", "Uruguay", "212", "[]"),
                cache, new MatchEventProcessor.Batch(worldCup));
        Match stored = savedMatch();
        stored.setId(10L);
        reset(matchRepository, matchPredictionService, topScorerService);
        when(matchRepository.findByExternalId("401")).thenReturn(Optional.of(stored));
        return stored;
    }

    @Test
    @DisplayName("Si ESPN corrige el marcador de un partido terminado, se vuelven a puntuar sus pronósticos")
    void reevaluatesWhenAFinishedScoreIsCorrected() throws Exception {
        Match stored = storedFinishedMatch("2", "1");
        MatchEventProcessor.Batch batch = new MatchEventProcessor.Batch(worldCup);

        processor.process(event("post", true, "Group H", "2", "2", "Spain", "164", "Uruguay", "212", "[]"), cache, batch);

        assertEquals(2, stored.getAwayScore());
        verify(matchRepository).save(stored);
        verify(matchPredictionService).evaluatePredictionsForMatch(stored);
        verify(topScorerService, never()).refresh(org.mockito.ArgumentMatchers.any());
        assertTrue(batch.resultsChanged());
    }

    @Test
    @DisplayName("Una tarjeta corregida en un partido terminado cambia el desempate de grupos: cuenta como resultado")
    void flagsFairPlayCorrectionsOfFinishedMatches() throws Exception {
        Match stored = storedFinishedMatch("2", "1");
        String lateCard = """
                [{"yellowCard": true, "team": {"id": "212"}, "athletesInvolved": [{"id": "p9"}]}]
                """;
        MatchEventProcessor.Batch batch = new MatchEventProcessor.Batch(worldCup);

        processor.process(event("post", true, "Group H", "2", "1", "Spain", "164", "Uruguay", "212", lateCard), cache, batch);

        assertEquals(-1, stored.getAwayFairPlay());
        assertTrue(batch.resultsChanged());
    }

    @Test
    @DisplayName("Un partido terminado con pronósticos sin puntuar se puntúa aunque no cambie")
    void evaluatesUnscoredPredictionsOfAnUnchangedFinishedMatch() throws Exception {
        Match stored = storedFinishedMatch("2", "1");
        when(matchPredictionService.hasUnscoredPredictions(10L)).thenReturn(true);

        processor.process(event("post", true, "Group H", "2", "1", "Spain", "164", "Uruguay", "212", "[]"),
                cache, new MatchEventProcessor.Batch(worldCup));

        verify(matchRepository, never()).save(any());
        verify(matchPredictionService).evaluatePredictionsForMatch(stored);
        verify(topScorerService, never()).refresh(org.mockito.ArgumentMatchers.any());
    }

    @Test
    @DisplayName("Un partido terminado sin cambios y ya puntuado no se vuelve a evaluar")
    void skipsFinishedMatchesAlreadyScored() throws Exception {
        storedFinishedMatch("2", "1");
        when(matchPredictionService.hasUnscoredPredictions(10L)).thenReturn(false);

        processor.process(event("post", true, "Group H", "2", "1", "Spain", "164", "Uruguay", "212", "[]"),
                cache, new MatchEventProcessor.Batch(worldCup));

        verify(matchPredictionService, never()).evaluatePredictionsForMatch(any());
        verify(topScorerService, never()).refresh(org.mockito.ArgumentMatchers.any());
    }

    @Test
    @DisplayName("Refrescar la caché de equipos la sustituye entera: el mapa que ya se usaba no se vacía")
    void teamCacheRefreshReplacesTheMapAtomically() {
        when(teamRepository.findAll()).thenReturn(List.of(spain), List.of(spain, uruguay));

        Map<String, Team> inUse = processor.teamCache();
        ReflectionTestUtils.setField(processor, "lastTeamCacheRefresh", 0L);
        Map<String, Team> refreshed = processor.teamCache();

        assertNotSame(inUse, refreshed);
        assertSame(spain, inUse.get("España"), "una sincronización en curso conserva sus equipos");
        assertSame(uruguay, refreshed.get("212"));
        assertSame(refreshed, processor.teamCache());
    }

    private final Competition laLiga = Competition.builder().id(4L).name("LaLiga EA Sports")
            .externalId("esp.1").formatType("LEAGUE").build();

    /** Jornada {@code number} con {@code count} partidos entre 20 equipos, uno al día desde {@code start}. */
    private List<Match> matchday(int number, int count, Instant start) {
        List<Match> matches = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            Team home = Team.builder().id((long) (100 + 2 * i)).name("L" + i).build();
            Team away = Team.builder().id((long) (101 + 2 * i)).name("V" + i).build();
            matches.add(Match.builder().id((long) (number * 100 + i)).homeTeam(home).awayTeam(away)
                    .round("Jornada " + number).matchDate(start.plus(i * 3L, ChronoUnit.HOURS)).build());
        }
        return matches;
    }

    @Test
    @DisplayName("Un partido de liga nuevo tras una jornada completa abre la siguiente")
    void newLeagueMatchAfterCompleteMatchdayStartsNextOne() {
        List<Match> existing = new ArrayList<>(matchday(11, 10, AppTime.fromLocal(LocalDateTime.of(2026, 10, 24, 14, 0))));
        existing.addAll(matchday(12, 10, AppTime.fromLocal(LocalDateTime.of(2026, 10, 30, 21, 0))));
        when(matchRepository.findByCompetitionIdAndRoundStartingWith(4L, "Jornada ")).thenReturn(existing);

        assertEquals("Jornada 13", processor.inferLeagueMatchday(laLiga, AppTime.fromLocal(LocalDateTime.of(2026, 11, 6, 21, 0))));
    }

    @Test
    @DisplayName("Un partido cercano a una jornada incompleta se queda en ella")
    void newLeagueMatchJoinsIncompleteMatchday() {
        List<Match> existing = new ArrayList<>(matchday(12, 10, AppTime.fromLocal(LocalDateTime.of(2026, 10, 30, 21, 0))));
        existing.addAll(matchday(13, 9, AppTime.fromLocal(LocalDateTime.of(2026, 11, 6, 21, 0))));
        when(matchRepository.findByCompetitionIdAndRoundStartingWith(4L, "Jornada ")).thenReturn(existing);

        assertEquals("Jornada 13", processor.inferLeagueMatchday(laLiga, AppTime.fromLocal(LocalDateTime.of(2026, 11, 8, 21, 0))));
        assertEquals("Jornada 14", processor.inferLeagueMatchday(laLiga, AppTime.fromLocal(LocalDateTime.of(2026, 11, 21, 18, 0))));
    }

    @Test
    @DisplayName("Sin numeración previa, en torneos o tras un parón de temporada no se inventa la jornada")
    void doesNotInventMatchdayNumbers() {
        Instant date = AppTime.fromLocal(LocalDateTime.of(2026, 11, 6, 21, 0));
        when(matchRepository.findByCompetitionIdAndRoundStartingWith(4L, "Jornada ")).thenReturn(List.of());
        assertNull(processor.inferLeagueMatchday(laLiga, date));
        assertNull(processor.inferLeagueMatchday(worldCup, date));

        when(matchRepository.findByCompetitionIdAndRoundStartingWith(4L, "Jornada "))
                .thenReturn(new ArrayList<>(matchday(38, 10, AppTime.fromLocal(LocalDateTime.of(2026, 5, 23, 21, 0)))));
        assertNull(processor.inferLeagueMatchday(laLiga, AppTime.fromLocal(LocalDateTime.of(2026, 8, 15, 19, 0))));
    }

    private JsonNode legEvent(String slug, int leg, String homeExtra, String awayExtra) throws Exception {
        return JSON.readTree("""
                {"id": "401", "date": "2026-03-10T20:00Z", "season": {"slug": "%s"},
                 "competitions": [{
                   "altGameNote": "UEFA Champions League, Round of 16",
                   "leg": {"value": %d}, "series": {"totalCompetitions": 2},
                   "status": {"type": {"state": "post", "completed": true}},
                   "competitors": [
                     {"homeAway": "home", "score": "1", "team": {"displayName": "Spain", "id": "164"}%s},
                     {"homeAway": "away", "score": "0", "team": {"displayName": "Uruguay", "id": "212"}%s}
                   ]
                 }]}
                """.formatted(slug, leg, homeExtra, awayExtra));
    }

    @Test
    @DisplayName("Las eliminatorias de una competición de liga guardan su ronda y la ida no decide quién pasa")
    void leagueKnockoutKeepsRoundAndFirstLegHasNoQualifier() throws Exception {
        Competition champions = Competition.builder().id(5L).externalId("uefa.champions").formatType("LEAGUE").build();
        when(matchRepository.findByExternalId("401")).thenReturn(Optional.empty());

        processor.process(legEvent("round-of-16", 1, ", \"winner\": true", ", \"winner\": false"), cache,
                new MatchEventProcessor.Batch(champions));

        Match match = savedMatch();
        assertEquals("r16", match.getRound());
        assertNull(match.getWinnerTeam(), "ganar la ida no es pasar");
    }

    @Test
    @DisplayName("La vuelta marca quién pasa con advance")
    void secondLegMarksTheQualifier() throws Exception {
        Competition champions = Competition.builder().id(5L).externalId("uefa.champions").formatType("LEAGUE").build();
        when(matchRepository.findByExternalId("401")).thenReturn(Optional.empty());

        processor.process(legEvent("knockout-round-playoffs", 2, ", \"winner\": true",
                ", \"winner\": false, \"advance\": true"), cache, new MatchEventProcessor.Batch(champions));

        Match match = savedMatch();
        assertEquals("playoff", match.getRound());
        assertSame(uruguay, match.getWinnerTeam());
    }

    @Test
    @DisplayName("La fase de liga de una competición de liga no guarda ronda")
    void leaguePhaseHasNoRound() throws Exception {
        Competition champions = Competition.builder().id(5L).externalId("uefa.champions").formatType("LEAGUE").build();
        when(matchRepository.findByExternalId("401")).thenReturn(Optional.empty());
        lenient().when(matchRepository.findByCompetitionIdAndRoundStartingWith(5L, "Jornada ")).thenReturn(List.of());

        processor.process(legEvent("league-phase", 1, "", ""), cache, new MatchEventProcessor.Batch(champions));

        assertNotEquals("r16", savedMatch().getRound());
    }

    private JsonNode nflEvent(String name) throws Exception {
        try (var input = getClass().getResourceAsStream("/espn/nfl-scoreboard.json")) {
            for (JsonNode event : JSON.readTree(java.util.Objects.requireNonNull(input)).path("events")) {
                if (event.path("name").asText().equals(name)) return event;
            }
        }
        throw new IllegalArgumentException(name);
    }

    @Test
    @DisplayName("Un partido de la NFL va a su semana de ESPN y la pretemporada no se guarda")
    void nflGamesTakeTheirEspnWeekAndPreseasonIsSkipped() throws Exception {
        Competition nfl = Competition.builder().id(30L).name("NFL").externalId("nfl").formatType("LEAGUE").build();
        Team ravens = Team.builder().id(31L).name("Baltimore Ravens").externalId("33").build();
        Team jaguars = Team.builder().id(32L).name("Jacksonville Jaguars").externalId("30").build();
        Map<String, Team> nflTeams = new HashMap<>(Map.of("Baltimore Ravens", ravens, "Jacksonville Jaguars", jaguars));
        when(matchRepository.findByExternalId("401873037")).thenReturn(Optional.empty());
        when(matchRepository.save(any(Match.class))).thenAnswer(invocation -> invocation.getArgument(0));

        processor.process(nflEvent("Jacksonville Jaguars at Baltimore Ravens"), nflTeams, new MatchEventProcessor.Batch(nfl));
        processor.process(nflEvent("Indianapolis Colts at Baltimore Ravens"), nflTeams, new MatchEventProcessor.Batch(nfl));

        Match game = savedMatch();
        assertEquals("Semana 9", game.getRound());
        assertEquals(10, game.getHomeScore());
        assertEquals(33, game.getAwayScore());
        assertSame(jaguars, game.getWinnerTeam());
        verify(matchRepository, never()).findByExternalId(nflEvent("Indianapolis Colts at Baltimore Ravens").path("id").asText());
    }

    @Test
    @DisplayName("Importar el catálogo no cambia el nombre en español de un equipo que ya existe")
    void importTeamsKeepsTheLocalNameOfAnExistingTeam() throws Exception {
        when(teamRepository.findByName("España")).thenReturn(Optional.of(spain));
        when(teamRepository.save(any(Team.class))).thenAnswer(inv -> inv.getArgument(0));
        JsonNode teams = JSON.readTree("""
                [{"team": {"id": "164", "displayName": "Spain", "abbreviation": "ESP",
                           "logos": [{"href": "https://example.test/esp.png"}]}}]
                """);
        Map<String, Team> imported = new HashMap<>();

        assertEquals(1, processor.importTeams(teams, imported));

        assertEquals("España", spain.getName());
        assertEquals("Spain", spain.getNameEn());
        assertEquals("https://example.test/esp.png", spain.getLogoUrl());
        assertSame(spain, imported.get("España"));
        assertSame(spain, imported.get("Spain"));
        assertSame(spain, imported.get("164"));
    }

    @Test
    @DisplayName("Un equipo nuevo del catálogo se guarda con su nombre en español")
    void importTeamsCreatesNewTeamsWithTheirLocalName() throws Exception {
        when(teamRepository.findByName(anyString())).thenReturn(Optional.empty());
        when(teamRepository.findByExternalId("478")).thenReturn(Optional.empty());
        when(teamRepository.save(any(Team.class))).thenAnswer(inv -> inv.getArgument(0));
        JsonNode teams = JSON.readTree("""
                [{"team": {"id": "478", "displayName": "France"}}]
                """);
        Map<String, Team> imported = new HashMap<>();

        processor.importTeams(teams, imported);

        Team france = imported.get("478");
        assertEquals("Francia", france.getName());
        assertEquals("France", france.getNameEn());
    }
}
