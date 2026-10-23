package com.porra.mundial.sports;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

import java.io.ByteArrayInputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.zip.GZIPInputStream;

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
        String url;
        if (dateRange != null && !dateRange.isBlank() && !dateRange.contains("-")) {
            url = espnScoreboardUrl + (espnScoreboardUrl.contains("?") ? "&" : "?") + "dates=" + dateRange + "&limit=200";
        } else {
            url = espnScoreboardUrl + (espnScoreboardUrl.contains("?") ? "&" : "?") + "limit=200";
        }

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofSeconds(15))
                .header("Accept", "application/json")
                .header("Accept-Encoding", "identity")
                .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
                .GET()
                .build();

        HttpResponse<byte[]> response = httpClient.send(request, HttpResponse.BodyHandlers.ofByteArray());
        byte[] bodyBytes = response.body();

        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            log.warn("ESPN API returned HTTP {}: {}", response.statusCode(), url);
            return objectMapper.createArrayNode();
        }

        if (bodyBytes == null || bodyBytes.length == 0) {
            return objectMapper.createArrayNode();
        }

        String json;
        String contentEncoding = response.headers().firstValue("Content-Encoding").orElse("");
        boolean isGzip = "gzip".equalsIgnoreCase(contentEncoding)
                || (bodyBytes.length >= 2 && bodyBytes[0] == (byte) 0x1f && bodyBytes[1] == (byte) 0x8b);

        if (isGzip) {
            try (GZIPInputStream gis = new GZIPInputStream(new ByteArrayInputStream(bodyBytes))) {
                json = new String(gis.readAllBytes(), StandardCharsets.UTF_8);
            }
        } else {
            json = new String(bodyBytes, StandardCharsets.UTF_8);
        }

        if (json == null || !json.trim().startsWith("{")) {
            log.warn("ESPN API response is not JSON from {}: {}", url, json != null && json.length() > 200 ? json.substring(0, 200) : json);
            return objectMapper.createArrayNode();
        }

        JsonNode root = objectMapper.readTree(json);
        JsonNode events = root.path("events");

        if (!events.isArray()) {
            return objectMapper.createArrayNode();
        }
        return events;
    }
}
