package com.porra.mundial.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.porra.mundial.dto.LeagueStandingDTO;
import com.porra.mundial.model.Competition;
import com.porra.mundial.model.Match;
import com.porra.mundial.repository.CompetitionRepository;
import com.porra.mundial.repository.MatchRepository;
import com.porra.mundial.sports.EspnSportsDataProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * Controlador REST que gestiona las Competiciones y sus tablas de clasificación oficial.
 */
@RestController
@RequestMapping("/api/competitions")
@RequiredArgsConstructor
@Slf4j
public class CompetitionController {

    private final CompetitionRepository competitionRepository;
    private final EspnSportsDataProvider espnSportsDataProvider;
    private final MatchRepository matchRepository;

    /**
     * Recupera la lista de todas las competiciones disponibles en el sistema.
     */
    @GetMapping
    @Cacheable("competitions")
    public ResponseEntity<List<Competition>> getAllCompetitions() {
        return ResponseEntity.ok(competitionRepository.findAll());
    }

    /**
     * Obtiene la tabla de clasificación oficial real de una liga (LaLiga, Premier, Champions, etc.)
     * consultando la API de ESPN con fallback a los partidos de la base de datos.
     */
    @GetMapping("/{id}/standings")
    @Cacheable(value = "competitionStandings", key = "#id")
    public ResponseEntity<List<LeagueStandingDTO>> getCompetitionStandings(@PathVariable Long id) {
        Optional<Competition> compOpt = competitionRepository.findById(id);
        if (compOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Competition comp = compOpt.get();
        List<LeagueStandingDTO> standings = new ArrayList<>();

        if (comp.getExternalId() != null && !comp.getExternalId().isBlank()) {
            try {
                JsonNode root = espnSportsDataProvider.fetchStandings(comp.getExternalId());
                if (root != null) {
                    JsonNode entries = null;
                    if (root.has("children") && root.path("children").size() > 0) {
                        entries = root.path("children").path(0).path("standings").path("entries");
                    } else if (root.has("standings") && root.path("standings").has("entries")) {
                        entries = root.path("standings").path("entries");
                    }

                    if (entries != null && entries.isArray()) {
                        for (JsonNode entry : entries) {
                            String teamName = entry.path("team").path("displayName").asText(
                                    entry.path("team").path("name").asText("Equipo"));
                            String teamLogo = entry.path("team").path("logos").path(0).path("href").asText(null);

                            int rank = 0, pts = 0, mp = 0, w = 0, d = 0, l = 0, gd = 0, gf = 0, ga = 0;
                            JsonNode stats = entry.path("stats");
                            if (stats.isArray()) {
                                for (JsonNode stat : stats) {
                                    String name = stat.path("name").asText("");
                                    int val = stat.path("value").asInt(0);
                                    switch (name) {
                                        case "rank" -> rank = val;
                                        case "points" -> pts = val;
                                        case "gamesPlayed" -> mp = val;
                                        case "wins" -> w = val;
                                        case "ties" -> d = val;
                                        case "losses" -> l = val;
                                        case "pointDifferential" -> gd = val;
                                        case "pointsFor" -> gf = val;
                                        case "pointsAgainst" -> ga = val;
                                    }
                                }
                            }

                            standings.add(LeagueStandingDTO.builder()
                                    .rank(rank > 0 ? rank : standings.size() + 1)
                                    .teamName(teamName)
                                    .teamLogo(teamLogo)
                                    .points(pts)
                                    .gamesPlayed(mp)
                                    .wins(w)
                                    .ties(d)
                                    .losses(l)
                                    .goalDiff(gd)
                                    .goalsFor(gf)
                                    .goalsAgainst(ga)
                                    .build());
                        }
                    }
                }
            } catch (Exception e) {
                log.warn("Error fetching ESPN standings for {}: {}", comp.getExternalId(), e.getMessage());
            }
        }

        // Fallback: Si no hay datos de ESPN o falló la llamada, calcular a partir de matches finalizados
        if (standings.isEmpty()) {
            standings = calculateStandingsFromMatches(id);
        }

        standings.sort(Comparator.comparingInt(LeagueStandingDTO::getRank));
        return ResponseEntity.ok(standings);
    }

    private List<LeagueStandingDTO> calculateStandingsFromMatches(Long competitionId) {
        List<Match> matches = matchRepository.findByCompetitionId(competitionId).stream()
                .filter(m -> Boolean.TRUE.equals(m.getFinished()) && m.getHomeScore() != null && m.getAwayScore() != null)
                .toList();

        if (matches.isEmpty()) return Collections.emptyList();

        Map<String, int[]> stats = new HashMap<>(); // [pts, mp, w, d, l, gf, ga, gd]
        Map<String, String> logos = new HashMap<>();

        for (Match m : matches) {
            String home = m.getHomeTeam() != null ? m.getHomeTeam().getName() : "Local";
            String away = m.getAwayTeam() != null ? m.getAwayTeam().getName() : "Visitante";
            if (m.getHomeTeam() != null && m.getHomeTeam().getLogoUrl() != null) logos.put(home, m.getHomeTeam().getLogoUrl());
            if (m.getAwayTeam() != null && m.getAwayTeam().getLogoUrl() != null) logos.put(away, m.getAwayTeam().getLogoUrl());

            int hScore = m.getHomeScore();
            int aScore = m.getAwayScore();

            int[] h = stats.computeIfAbsent(home, k -> new int[8]);
            int[] a = stats.computeIfAbsent(away, k -> new int[8]);

            h[1]++; a[1]++; // mp
            h[5] += hScore; a[5] += aScore; // gf
            h[6] += aScore; a[6] += hScore; // ga
            h[7] += (hScore - aScore); a[7] += (aScore - hScore); // gd

            if (hScore > aScore) {
                h[0] += 3; h[2]++; a[4]++;
            } else if (aScore > hScore) {
                a[0] += 3; a[2]++; h[4]++;
            } else {
                h[0] += 1; a[0] += 1; h[3]++; a[3]++;
            }
        }

        List<LeagueStandingDTO> list = new ArrayList<>();
        for (Map.Entry<String, int[]> entry : stats.entrySet()) {
            int[] s = entry.getValue();
            list.add(LeagueStandingDTO.builder()
                    .teamName(entry.getKey())
                    .teamLogo(logos.get(entry.getKey()))
                    .points(s[0])
                    .gamesPlayed(s[1])
                    .wins(s[2])
                    .ties(s[3])
                    .losses(s[4])
                    .goalsFor(s[5])
                    .goalsAgainst(s[6])
                    .goalDiff(s[7])
                    .build());
        }

        list.sort((x, y) -> {
            if (x.getPoints() != y.getPoints()) return Integer.compare(y.getPoints(), x.getPoints());
            if (x.getGoalDiff() != y.getGoalDiff()) return Integer.compare(y.getGoalDiff(), x.getGoalDiff());
            return Integer.compare(y.getGoalsFor(), x.getGoalsFor());
        });

        for (int i = 0; i < list.size(); i++) {
            list.get(i).setRank(i + 1);
        }

        return list;
    }
}
