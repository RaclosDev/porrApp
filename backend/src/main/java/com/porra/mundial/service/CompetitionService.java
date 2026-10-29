package com.porra.mundial.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.porra.mundial.dto.CompetitionDTO;
import com.porra.mundial.dto.LeagueStandingDTO;
import com.porra.mundial.model.Competition;
import com.porra.mundial.model.Match;
import com.porra.mundial.repository.CompetitionRepository;
import com.porra.mundial.repository.MatchRepository;
import com.porra.mundial.sports.EspnSportsDataProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;

/** Competiciones disponibles y su clasificación oficial. */
@Service
@RequiredArgsConstructor
@Slf4j
public class CompetitionService {

    private final CompetitionRepository competitionRepository;
    private final MatchRepository matchRepository;
    private final EspnSportsDataProvider espnSportsDataProvider;

    /**
     * Competiciones con proveedor externo, ordenadas por nombre. Las que no tienen id externo
     * no se pueden sincronizar y dejarían a la liga sin equipos ni partidos.
     */
    @Cacheable("competitions")
    public List<CompetitionDTO> findSyncableCompetitions() {
        return competitionRepository.findAll().stream()
                .filter(c -> c.getExternalId() != null && !c.getExternalId().isBlank())
                .sorted(Comparator.comparing(Competition::getName, String.CASE_INSENSITIVE_ORDER))
                .map(CompetitionDTO::of)
                .toList();
    }

    /**
     * Clasificación oficial de una liga (LaLiga, Premier, Champions...). Se pide a ESPN y, si no
     * responde, se calcula con los partidos terminados guardados.
     */
    @Cacheable(value = "competitionStandings", key = "#competitionId")
    public List<LeagueStandingDTO> getStandings(Long competitionId) {
        Competition competition = competitionRepository.findById(competitionId)
                .orElseThrow(() -> new NoSuchElementException("Competición no encontrada"));

        List<LeagueStandingDTO> standings = new ArrayList<>();
        if (competition.getExternalId() != null && !competition.getExternalId().isBlank()) {
            try {
                standings = parseEspnStandings(espnSportsDataProvider.fetchStandings(competition.getExternalId()));
            } catch (Exception e) {
                log.warn("No se pudo obtener la clasificación de ESPN para {}: {}", competition.getExternalId(), e.getMessage());
            }
        }
        if (standings.isEmpty()) {
            standings = standingsFromMatches(competitionId);
        }
        standings.sort(Comparator.comparingInt(LeagueStandingDTO::getRank));
        return standings;
    }

    private List<LeagueStandingDTO> parseEspnStandings(JsonNode root) {
        List<LeagueStandingDTO> standings = new ArrayList<>();
        if (root == null) return standings;

        JsonNode entries = root.path("children").size() > 0
                ? root.path("children").path(0).path("standings").path("entries")
                : root.path("standings").path("entries");
        if (!entries.isArray()) return standings;

        for (JsonNode entry : entries) {
            Map<String, Integer> stats = new HashMap<>();
            for (JsonNode stat : entry.path("stats")) {
                stats.put(stat.path("name").asText(""), stat.path("value").asInt(0));
            }
            int rank = stats.getOrDefault("rank", 0);
            standings.add(LeagueStandingDTO.builder()
                    .rank(rank > 0 ? rank : standings.size() + 1)
                    .teamName(entry.path("team").path("displayName").asText(entry.path("team").path("name").asText("Equipo")))
                    .teamLogo(entry.path("team").path("logos").path(0).path("href").asText(null))
                    .points(stats.getOrDefault("points", 0))
                    .gamesPlayed(stats.getOrDefault("gamesPlayed", 0))
                    .wins(stats.getOrDefault("wins", 0))
                    .ties(stats.getOrDefault("ties", 0))
                    .losses(stats.getOrDefault("losses", 0))
                    .goalDiff(stats.getOrDefault("pointDifferential", 0))
                    .goalsFor(stats.getOrDefault("pointsFor", 0))
                    .goalsAgainst(stats.getOrDefault("pointsAgainst", 0))
                    .build());
        }
        return standings;
    }

    /** Clasificación calculada con los partidos terminados: puntos, diferencia de goles y goles a favor. */
    private List<LeagueStandingDTO> standingsFromMatches(Long competitionId) {
        Map<String, LeagueStandingDTO> table = new HashMap<>();
        for (Match m : matchRepository.findByCompetitionId(competitionId)) {
            if (!Boolean.TRUE.equals(m.getFinished()) || m.getHomeScore() == null || m.getAwayScore() == null) continue;
            LeagueStandingDTO home = row(table, m.getHomeTeam() != null ? m.getHomeTeam().getName() : "Local",
                    m.getHomeTeam() != null ? m.getHomeTeam().getLogoUrl() : null);
            LeagueStandingDTO away = row(table, m.getAwayTeam() != null ? m.getAwayTeam().getName() : "Visitante",
                    m.getAwayTeam() != null ? m.getAwayTeam().getLogoUrl() : null);
            addResult(home, m.getHomeScore(), m.getAwayScore());
            addResult(away, m.getAwayScore(), m.getHomeScore());
        }

        List<LeagueStandingDTO> list = new ArrayList<>(table.values());
        list.sort(Comparator.comparingInt(LeagueStandingDTO::getPoints)
                .thenComparingInt(LeagueStandingDTO::getGoalDiff)
                .thenComparingInt(LeagueStandingDTO::getGoalsFor)
                .reversed());
        for (int i = 0; i < list.size(); i++) {
            list.get(i).setRank(i + 1);
        }
        return list;
    }

    private static LeagueStandingDTO row(Map<String, LeagueStandingDTO> table, String team, String logo) {
        LeagueStandingDTO row = table.computeIfAbsent(team, name -> LeagueStandingDTO.builder().teamName(name).build());
        if (logo != null) row.setTeamLogo(logo);
        return row;
    }

    private static void addResult(LeagueStandingDTO row, int goalsFor, int goalsAgainst) {
        row.setGamesPlayed(row.getGamesPlayed() + 1);
        row.setGoalsFor(row.getGoalsFor() + goalsFor);
        row.setGoalsAgainst(row.getGoalsAgainst() + goalsAgainst);
        row.setGoalDiff(row.getGoalDiff() + goalsFor - goalsAgainst);
        if (goalsFor > goalsAgainst) {
            row.setPoints(row.getPoints() + 3);
            row.setWins(row.getWins() + 1);
        } else if (goalsFor < goalsAgainst) {
            row.setLosses(row.getLosses() + 1);
        } else {
            row.setPoints(row.getPoints() + 1);
            row.setTies(row.getTies() + 1);
        }
    }
}
