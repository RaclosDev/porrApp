package com.porra.mundial.service;

import com.porra.mundial.model.*;
import com.porra.mundial.repository.*;
import com.porra.mundial.sports.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.PlatformTransactionManager;
import java.time.Instant;
import java.util.List;
import java.util.stream.LongStream;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class LegacyFixtureRepairServiceTest {
    @Mock MatchRepository matches;
    @Mock TeamRepository teams;
    @Mock SportsDataProviderRegistry providers;
    @Mock MatchEventProcessor processor;
    @Mock ScoreInvalidationService scores;
    @Mock WebSocketService updates;
    @Mock PlatformTransactionManager transactions;
    @Mock SportsDataProvider provider;
    @InjectMocks LegacyFixtureRepairService repair;

    private List<Match> candidates(int count) {
        var competition = Competition.builder().id(4L).externalId("esp.1").build();
        return LongStream.rangeClosed(1, count).mapToObj(id -> Match.builder().id(id).externalId("" + id)
                .competition(competition).homeTeam(Team.builder().name("Equipo LaLiga 50").build()).build()).toList();
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings = {"event", "league", "status", "team", "date"})
    void rejectsIncompleteOrMismatchedEvidenceBeforeOpeningATransaction(String defect) throws Exception {
        var mapper = new tools.jackson.databind.ObjectMapper();
        tools.jackson.databind.node.ObjectNode event;
        try (var stream = getClass().getResourceAsStream("/espn/summary-401882926.json")) {
            event = (tools.jackson.databind.node.ObjectNode) mapper.readTree(stream).path("header").deepCopy();
        }
        event.put("id", "1");
        event.put("date", "2026-08-15T17:30Z");
        var competition = (tools.jackson.databind.node.ObjectNode) event.path("competitions").get(0);
        competition.put("id", "1");
        switch (defect) {
            case "event" -> event.put("id", "2");
            case "league" -> ((tools.jackson.databind.node.ObjectNode) event.path("league")).put("slug", "eng.1");
            case "status" -> competition.remove("status");
            case "team" -> ((tools.jackson.databind.node.ObjectNode) competition.path("competitors").get(0).path("team"))
                    .put("displayName", "Equipo LaLiga 50");
            case "date" -> event.put("date", "invalid");
            default -> throw new AssertionError();
        }
        when(matches.findLegacyPlaceholderFixtures(eq(0L), any())).thenReturn(candidates(1));
        when(providers.getProviderForCompetition("esp.1")).thenReturn(provider);
        when(provider.isAvailable()).thenReturn(true);
        when(provider.fetchEvent("esp.1", "1")).thenReturn(event);

        assertEquals(new LegacyFixtureRepairService.RepairResult(1, 0, 1), repair.repairBatch());

        verifyNoInteractions(transactions, processor, teams, scores, updates);
    }

    @Test
    void limitsRequestsAndBacksOffFailuresWithoutStartingTransactions() throws Exception {
        var fixtures = candidates(20);
        when(matches.findLegacyPlaceholderFixtures(eq(0L), any())).thenReturn(fixtures);
        when(providers.getProviderForCompetition("esp.1")).thenReturn(provider);
        when(provider.isAvailable()).thenReturn(true);
        when(provider.fetchEvent(anyString(), anyString())).thenThrow(new java.io.IOException("503"));
        Instant now = Instant.parse("2026-10-31T12:00:00Z");

        assertEquals(new LegacyFixtureRepairService.RepairResult(20, 0, 20), repair.repairBatch(now));
        assertEquals(0, repair.repairBatch(now.plusSeconds(60)).attempted());
        assertEquals(20, repair.repairBatch(now.plusSeconds(6 * 3600)).attempted());

        verify(provider, times(40)).fetchEvent(anyString(), anyString());
        verifyNoInteractions(transactions, processor, teams, scores, updates);
    }

    @Test
    void interruptionStopsTheBatchAndPreservesTheInterruptFlag() throws Exception {
        when(matches.findLegacyPlaceholderFixtures(eq(0L), any())).thenReturn(candidates(2));
        when(providers.getProviderForCompetition("esp.1")).thenReturn(provider);
        when(provider.isAvailable()).thenReturn(true);
        when(provider.fetchEvent(anyString(), anyString())).thenThrow(new InterruptedException("closing"));
        try {
            assertEquals(1, repair.repairBatch().attempted());
            assertTrue(Thread.currentThread().isInterrupted());
            verify(provider, times(1)).fetchEvent(anyString(), anyString());
            verifyNoInteractions(transactions);
        } finally {
            Thread.interrupted();
        }
    }

    @Test
    void openCircuitMakesNoRequests() {
        when(matches.findLegacyPlaceholderFixtures(eq(0L), any())).thenReturn(candidates(2));
        when(providers.getProviderForCompetition("esp.1")).thenReturn(provider);

        assertEquals(0, repair.repairBatch().attempted());

        verifyNoInteractions(transactions);
    }
}
