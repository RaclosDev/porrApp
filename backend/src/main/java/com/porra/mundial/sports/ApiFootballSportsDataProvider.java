package com.porra.mundial.sports;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

/**
 * Adaptador para proveedores profesionales de datos de ligas domésticas (API-Football / Sportmonks) (Fase 4).
 * Da cobertura a ligas regulares (LaLiga, Premier League, Champions) desacoplado de ESPN.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ApiFootballSportsDataProvider implements SportsDataProvider {

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;

    @Value("${app.sports.api-football.url:https://v3.football.api-sports.io}")
    private String apiUrl;

    @Value("${app.sports.api-football.key:}")
    private String apiKey;

    @Override
    public String getProviderName() {
        return "API-Football";
    }

    @Override
    public boolean supports(String competitionCode) {
        if (competitionCode == null || competitionCode.isBlank()) return false;
        String lower = competitionCode.toLowerCase();
        return lower.contains("laliga") || lower.contains("premier") || lower.contains("champions") || lower.contains("seriea");
    }

    @Override
    public JsonNode fetchScoreboardEvents(String dateRange) throws Exception {
        if (apiKey == null || apiKey.isBlank()) {
            log.info("API-Football key no configurada. Simulando feed para ligas regulares.");
            return objectMapper.createArrayNode();
        }

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(apiUrl + "/fixtures?dates=" + dateRange))
                .timeout(Duration.ofSeconds(15))
                .header("x-apisports-key", apiKey)
                .header("Accept", "application/json")
                .GET()
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        String body = response.body();

        if (body == null || !body.trim().startsWith("{")) {
            throw new IllegalStateException("API-Football devolvió una respuesta no JSON");
        }

        JsonNode root = objectMapper.readTree(body);
        return root.path("response");
    }
}
