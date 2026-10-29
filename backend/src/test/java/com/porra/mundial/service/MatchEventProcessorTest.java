package com.porra.mundial.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.porra.mundial.model.Competition;
import com.porra.mundial.model.Match;
import com.porra.mundial.model.MatchStatusNormalized;
import com.porra.mundial.model.Team;
import com.porra.mundial.repository.MatchRepository;
import com.porra.mundial.repository.TeamRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

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
        spain = Team.builder().id(1L).name("España").nameEn("Spain").externalId("164").groupName("H").build();
        uruguay = Team.builder().id(2L).name("Uruguay").nameEn("Uruguay").externalId("212").groupName("H").build();
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
        verify(topScorerService).refresh();
        verify(webSocketService).broadcastMatchScore(any(), eq("España"), eq("Uruguay"), eq(2), eq(1), eq("FINISHED"));
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
    @DisplayName("Un gol en directo no cambia los resultados que puntúan los cuadros; el final del partido, sí")
    void flagsResultChangesOnlyWhenTheResultCounts() throws Exception {
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
        assertFalse(goal.resultsChanged());

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
        verify(topScorerService).refresh();
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
        verify(topScorerService, never()).refresh();
    }

    @Test
    @DisplayName("Un partido terminado sin cambios y ya puntuado no se vuelve a evaluar")
    void skipsFinishedMatchesAlreadyScored() throws Exception {
        storedFinishedMatch("2", "1");
        when(matchPredictionService.hasUnscoredPredictions(10L)).thenReturn(false);

        processor.process(event("post", true, "Group H", "2", "1", "Spain", "164", "Uruguay", "212", "[]"),
                cache, new MatchEventProcessor.Batch(worldCup));

        verify(matchPredictionService, never()).evaluatePredictionsForMatch(any());
        verify(topScorerService, never()).refresh();
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
}
