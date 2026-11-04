package com.porra.mundial.sports;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

import java.net.http.HttpClient;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class FootballDataClientTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void parsesOnlyCompleteFixtures() {
        var root = mapper.readTree("""
                {"matches": [
                  {"utcDate": "2026-11-08T20:00:00Z", "matchday": 13, "homeTeam": {"id": 86}, "awayTeam": {"id": 81}},
                  {"utcDate": "2026-11-09T15:00:00Z", "matchday": null, "homeTeam": {"id": 1}, "awayTeam": {"id": 2}},
                  {"utcDate": "no es fecha", "matchday": 13, "homeTeam": {"id": 3}, "awayTeam": {"id": 4}},
                  {"utcDate": "2026-11-09T18:00:00Z", "matchday": 13, "homeTeam": {"id": null}, "awayTeam": {"id": 5}}
                ]}
                """);

        assertThat(FootballDataClient.parseFixtures(root)).containsExactly(
                new FootballDataClient.OfficialFixture(Instant.parse("2026-11-08T20:00:00Z"), 13, 86, 81));
    }

    @Test
    void isDisabledWithoutToken() {
        assertThat(new FootballDataClient(mock(HttpClient.class), mapper, " ").isEnabled()).isFalse();
        assertThat(new FootballDataClient(mock(HttpClient.class), mapper, "abc").isEnabled()).isTrue();
    }
}
