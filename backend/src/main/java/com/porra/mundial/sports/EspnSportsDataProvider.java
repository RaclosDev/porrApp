package com.porra.mundial.sports;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

/**
 * Adaptador para la API pública de ESPN (scoreboard de fútbol).
 */
@Component
@Primary
@RequiredArgsConstructor
@Slf4j
public class EspnSportsDataProvider implements SportsDataProvider {

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;

    @Value("${app.espn.scoreboard-url:https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard}")
    private String espnScoreboardUrl;

    @Override
    public String getProviderName() {
        return "ESPN";
    }

    @Override
    public boolean supports(String competitionCode) {
        if (competitionCode == null || competitionCode.isBlank()) return true;
        String lower = competitionCode.toLowerCase();
        return lower.contains("fifa") || lower.contains("world") || lower.contains("mundial") || lower.contains("espn");
    }

    @Override
    public JsonNode fetchScoreboardEvents(String dateRange) throws Exception {
        String url = espnScoreboardUrl + "?dates=" + dateRange + "&limit=200";
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofSeconds(15))
                .header("Accept", "application/json")
                .GET()
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        String json = response.body();

        if (json == null || !json.trim().startsWith("{")) {
            throw new IllegalStateException("ESPN API returned non-JSON response");
        }

        JsonNode root = objectMapper.readTree(json);
        JsonNode events = root.path("events");

        if (!events.isArray()) {
            throw new IllegalStateException("ESPN API: no events array found");
        }
        return events;
    }
}
