package com.porra.mundial.controller;

import com.porra.mundial.service.TopScorerService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 🥅 Controlador de Pichichi — Expone los máximos goleadores del Mundial
 */
@RestController
@RequestMapping("/api/scorers")
@RequiredArgsConstructor
public class TopScorerController {

    private final TopScorerService topScorerService;

    @GetMapping
    public List<Map<String, Object>> getTopScorers() {
        return topScorerService.getTopScorers();
    }

    @PostMapping("/refresh")
    public Map<String, String> forceRefresh() {
        topScorerService.refresh();
        return Map.of("status", "ok", "scorers", String.valueOf(topScorerService.getTopScorers().size()));
    }

    @GetMapping("/image/{playerId}")
    public org.springframework.http.ResponseEntity<byte[]> getPlayerImage(@PathVariable Long playerId) {
        try {
            org.springframework.web.client.RestTemplate restTemplate = new org.springframework.web.client.RestTemplate();
            org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
            // Simular un navegador real para saltarse la protección anti-scraping (403 Forbidden)
            headers.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
            headers.set("Origin", "https://www.sofascore.com");
            headers.set("Referer", "https://www.sofascore.com/");
            
            org.springframework.http.HttpEntity<String> entity = new org.springframework.http.HttpEntity<>(headers);
            
            org.springframework.http.ResponseEntity<byte[]> response = restTemplate.exchange(
                    "https://api.sofascore.app/api/v1/player/" + playerId + "/image",
                    org.springframework.http.HttpMethod.GET,
                    entity,
                    byte[].class
            );
            
            org.springframework.http.HttpHeaders responseHeaders = new org.springframework.http.HttpHeaders();
            responseHeaders.set("Content-Type", "image/png");
            responseHeaders.set("Cache-Control", "max-age=86400"); // Cachear 1 día en el navegador
            
            return new org.springframework.http.ResponseEntity<>(response.getBody(), responseHeaders, org.springframework.http.HttpStatus.OK);
        } catch (Exception e) {
            // Si falla, devolvemos 404 para que el frontend pueda cargar un fallback
            return org.springframework.http.ResponseEntity.notFound().build();
        }
    }
}
