package com.porra.mundial.sports;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Calendario oficial de football-data.org: solo se usa para el número de jornada, que ESPN no da.
 * Los marcadores siguen llegando de ESPN. Sin {@code FOOTBALL_DATA_TOKEN} queda desactivado.
 */
@Component
@Slf4j
public class FootballDataClient {

    private static final String BASE_URL = "https://api.football-data.org/v4/competitions/";
    private static final Duration TIMEOUT = Duration.ofSeconds(20);

    /** Ligas del plan gratuito, por slug de ESPN. */
    private static final Map<String, String> COMPETITION_CODES = Map.of(
            "esp.1", "PD",
            "eng.1", "PL",
            "ger.1", "BL1",
            "ita.1", "SA",
            "fra.1", "FL1",
            "ned.1", "DED",
            "por.1", "PPL");

    /** Partido del calendario oficial; los equipos se identifican por su id en football-data. */
    public record OfficialFixture(Instant kickoff, int matchday, long homeTeamId, long awayTeamId) {}

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final String token;

    public FootballDataClient(HttpClient httpClient, ObjectMapper objectMapper,
                              @Value("${app.football-data.token:}") String token) {
        this.httpClient = httpClient;
        this.objectMapper = objectMapper;
        this.token = token == null ? "" : token.trim();
    }

    public boolean isEnabled() {
        return !token.isEmpty();
    }

    /** Códigos de football-data por slug de ESPN. */
    public Map<String, String> competitionCodes() {
        return COMPETITION_CODES;
    }

    /** Partidos de la temporada en curso de una competición. */
    public List<OfficialFixture> fetchSeasonFixtures(String code) throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder(URI.create(BASE_URL + code + "/matches"))
                .timeout(TIMEOUT)
                .header("X-Auth-Token", token)
                .header("Accept", "application/json")
                .GET()
                .build();
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200) {
            throw new IOException("football-data.org respondió " + response.statusCode() + " para " + code);
        }
        return parseFixtures(objectMapper.readTree(response.body()));
    }

    static List<OfficialFixture> parseFixtures(JsonNode root) {
        List<OfficialFixture> fixtures = new ArrayList<>();
        for (JsonNode match : root.path("matches")) {
            int matchday = match.path("matchday").asInt(0);
            long home = match.path("homeTeam").path("id").asLong(0);
            long away = match.path("awayTeam").path("id").asLong(0);
            String date = match.path("utcDate").asText("");
            if (matchday <= 0 || home == 0 || away == 0 || date.isEmpty()) continue;
            try {
                fixtures.add(new OfficialFixture(Instant.parse(date), matchday, home, away));
            } catch (RuntimeException invalidDate) {
                log.debug("Fecha no válida en football-data.org: {}", date);
            }
        }
        return fixtures;
    }
}
