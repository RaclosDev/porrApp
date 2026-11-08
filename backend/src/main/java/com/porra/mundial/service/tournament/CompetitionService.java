package com.porra.mundial.service.tournament;

import com.porra.mundial.exception.BusinessException;
import com.porra.mundial.dto.CompetitionDTO;
import com.porra.mundial.dto.LeagueStandingDTO;
import com.porra.mundial.model.Competition;
import com.porra.mundial.model.Sport;
import com.porra.mundial.model.Match;
import com.porra.mundial.repository.CompetitionRepository;
import com.porra.mundial.repository.MatchRepository;
import com.porra.mundial.sports.EspnSportsDataProvider;
import com.porra.mundial.sports.LolEsportsDataProvider;
import com.porra.mundial.sports.NflSchedule;
import com.porra.mundial.sports.TennisDataProvider;
import tools.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/** Competiciones disponibles y su clasificación oficial. */
@Service
@RequiredArgsConstructor
@Slf4j
public class CompetitionService {

    private final CompetitionRepository competitionRepository;
    private final MatchRepository matchRepository;
    private final EspnSportsDataProvider espnSportsDataProvider;
    private final TennisDataProvider tennisDataProvider;

    private static long count(Object value) {
        return value instanceof Number number ? number.longValue() : 0;
    }

    /**
     * Competiciones con proveedor externo, ordenadas por nombre, con lo que se sabe de su calendario. Las
     * que no tienen id externo no se pueden sincronizar y dejarían a la liga sin equipos ni partidos.
     */
    @Cacheable("competitions")
    public List<CompetitionDTO> findSyncableCompetitions() {
        Map<Long, CompetitionDTO.CalendarStats> stats = new HashMap<>();
        for (Object[] row : matchRepository.calendarStatsByCompetition()) {
            stats.put((Long) row[0], new CompetitionDTO.CalendarStats(count(row[1]), count(row[2]), count(row[3])));
        }
        Instant now = Instant.now();
        List<Competition> syncable = competitionRepository.findAll().stream()
                .filter(c -> c.getExternalId() != null && !c.getExternalId().isBlank())
                .sorted(Comparator.comparing(Competition::getName, String.CASE_INSENSITIVE_ORDER))
                .toList();
        // Las fechas de cada torneo de tenis son una consulta a ESPN (en caché): se piden a la vez.
        Map<Long, java.util.Optional<CompetitionDTO.TennisDates>> tennis = syncable.parallelStream()
                .filter(c -> tennisDataProvider.supports(c.getExternalId()))
                .collect(java.util.stream.Collectors.toConcurrentMap(Competition::getId,
                        c -> java.util.Optional.ofNullable(tennisDates(c))));
        return syncable.stream()
                .map(c -> CompetitionDTO.of(c, stats.get(c.getId()),
                        tennis.getOrDefault(c.getId(), java.util.Optional.empty()).orElse(null), now))
                .toList();
    }

    /** Fechas de la edición actual de un torneo de tenis; null si no lo es o ESPN no responde. */
    private CompetitionDTO.TennisDates tennisDates(Competition competition) {
        try {
            TennisDataProvider.Edition edition = tennisDataProvider.currentEdition(competition.getExternalId());
            return edition == null ? null : new CompetitionDTO.TennisDates(edition.start(), edition.end());
        } catch (Exception e) {
            log.warn("No se pudieron leer las fechas de {} en ESPN: {}", competition.getName(), e.getMessage());
            return null;
        }
    }

    /**
     * Clasificación oficial de una liga (LaLiga, Premier, Champions...). Se pide a ESPN y, si no
     * responde, se calcula con los partidos terminados guardados.
     */
    @Cacheable(value = "competitionStandings", key = "#competitionId")
    public List<LeagueStandingDTO> getStandings(Long competitionId) {
        Competition competition = competitionRepository.findById(competitionId)
                .orElseThrow(() -> BusinessException.notFound("Competición no encontrada"));
        if (competition.getOwnerLeague() != null) {
            throw BusinessException.notFound("Competición no encontrada");
        }

        if (LolEsportsDataProvider.isLolCompetition(competition.getExternalId())) {
            return lolStandings(matchRepository.findByCompetitionId(competitionId));
        }
        List<LeagueStandingDTO> standings = new ArrayList<>();
        if (competition.getExternalId() != null && !competition.getExternalId().isBlank()
                && !tennisDataProvider.supports(competition.getExternalId())
                && !com.porra.mundial.sports.UfcDataProvider.isUfcCompetition(competition.getExternalId())) {
            try {
                JsonNode espnStandings = espnSportsDataProvider.fetchStandings(competition.getExternalId());
                standings = NflSchedule.isNfl(competition.getExternalId())
                        ? parseNflStandings(espnStandings) : parseEspnStandings(espnStandings);
            } catch (Exception e) {
                log.warn("No se pudo obtener la clasificación de ESPN para {}: {}", competition.getExternalId(), e.getMessage());
            }
        }
        if (standings.isEmpty() && !isKnockoutCup(competition)) {
            standings = standingsFromMatches(competitionId);
        }
        return standings;
    }

    /**
     * Copa de fútbol que se juega solo por eliminatorias (Copa del Rey…): no tiene tabla. Sumar sus partidos
     * daría una de cien equipos con uno o dos partidos cada uno, que no dice nada.
     */
    static boolean isKnockoutCup(Competition competition) {
        return "TOURNAMENT".equals(competition.getFormatType()) && competition.drawsKnockoutRounds()
                && Sport.ofExternalId(competition.getExternalId()) == Sport.FOOTBALL;
    }

    public List<LeagueStandingDTO> getCustomStandings(Long competitionId) {
        return standingsFromMatches(competitionId);
    }

    /**
     * Tabla de ESPN con todos sus grupos o conferencias (Libertadores, MLS…), en el orden de ESPN y cada uno
     * con su título y sus puestos. Con un solo grupo (la fase liga de la Champions, LaLiga…) no lleva título.
     */
    static List<LeagueStandingDTO> parseEspnStandings(JsonNode root) {
        List<LeagueStandingDTO> standings = new ArrayList<>();
        if (root == null) return standings;

        List<JsonNode> groups = new ArrayList<>();
        if (root.path("children").size() > 0) root.path("children").forEach(groups::add);
        else groups.add(root);
        boolean titled = groups.size() > 1;

        for (JsonNode group : groups) {
            JsonNode entries = group.path("standings").path("entries");
            if (!entries.isArray()) continue;
            String title = titled ? groupTitle(group.path("name").asText("")) : null;
            List<LeagueStandingDTO> rows = new ArrayList<>();
            for (JsonNode entry : entries) {
                Map<String, Integer> stats = new HashMap<>();
                for (JsonNode stat : entry.path("stats")) {
                    stats.put(stat.path("name").asText(""), stat.path("value").asInt(0));
                }
                int rank = stats.getOrDefault("rank", 0);
                rows.add(LeagueStandingDTO.builder()
                        .group(title)
                        .rank(rank > 0 ? rank : rows.size() + 1)
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
            rows.sort(Comparator.comparingInt(LeagueStandingDTO::getRank));
            standings.addAll(rows);
        }
        return standings;
    }

    /** Nombre de un grupo de ESPN en español: «Group A» → «Grupo A», «Eastern Conference» → «Conferencia Este». */
    static String groupTitle(String name) {
        String trimmed = name == null ? "" : name.trim();
        if (trimmed.regionMatches(true, 0, "Group ", 0, 6)) return "Grupo " + trimmed.substring(6).trim();
        return switch (trimmed.toLowerCase(Locale.ROOT)) {
            case "eastern conference" -> "Conferencia Este";
            case "western conference" -> "Conferencia Oeste";
            case "league phase" -> "Fase liga";
            case "" -> "Grupo";
            default -> trimmed;
        };
    }

    /** Fases del LoL con tabla, en el orden en que se juegan. Las eliminatorias no tienen: son cruces. */
    private static final List<Map.Entry<String, String>> LOL_TABLE_PHASES =
            List.of(Map.entry("playin", "Play-in"), Map.entry("group", "Fase suiza"));

    /**
     * Tabla del LoL por fase: el play-in y la fase suiza, cada una con su balance de series ganadas y perdidas
     * (no hay empates ni puntos de fútbol). Los puntos son las victorias y los «goles», las partidas. Las
     * eliminatorias no entran.
     */
    static List<LeagueStandingDTO> lolStandings(List<Match> matches) {
        Map<String, Map<String, LeagueStandingDTO>> phases = new HashMap<>();
        for (Match m : matches) {
            if (!Boolean.TRUE.equals(m.getFinished()) || m.getHomeScore() == null || m.getAwayScore() == null
                    || m.getHomeTeam() == null || m.getAwayTeam() == null
                    || m.getHomeScore().equals(m.getAwayScore())) continue;
            Map<String, LeagueStandingDTO> table = phases.computeIfAbsent(m.getRound(), key -> new HashMap<>());
            LeagueStandingDTO home = row(table, m.getHomeTeam().getName(), m.getHomeTeam().getLogoUrl());
            LeagueStandingDTO away = row(table, m.getAwayTeam().getName(), m.getAwayTeam().getLogoUrl());
            addSeries(home, m.getHomeScore(), m.getAwayScore());
            addSeries(away, m.getAwayScore(), m.getHomeScore());
        }

        List<LeagueStandingDTO> standings = new ArrayList<>();
        for (Map.Entry<String, String> phase : LOL_TABLE_PHASES) {
            Map<String, LeagueStandingDTO> table = phases.get(phase.getKey());
            if (table == null) continue;
            List<LeagueStandingDTO> rows = new ArrayList<>(table.values());
            rows.sort(Comparator.comparingInt(LeagueStandingDTO::getWins).reversed()
                    .thenComparingInt(LeagueStandingDTO::getLosses)
                    .thenComparing(Comparator.comparingInt(LeagueStandingDTO::getGoalDiff).reversed())
                    .thenComparing(LeagueStandingDTO::getTeamName, String.CASE_INSENSITIVE_ORDER));
            for (int i = 0; i < rows.size(); i++) {
                rows.get(i).setRank(i + 1);
                rows.get(i).setGroup(phase.getValue());
            }
            standings.addAll(rows);
        }
        return standings;
    }

    private static void addSeries(LeagueStandingDTO row, int gamesWon, int gamesLost) {
        row.setGamesPlayed(row.getGamesPlayed() + 1);
        row.setGoalsFor(row.getGoalsFor() + gamesWon);
        row.setGoalsAgainst(row.getGoalsAgainst() + gamesLost);
        row.setGoalDiff(row.getGoalDiff() + gamesWon - gamesLost);
        if (gamesWon > gamesLost) {
            row.setWins(row.getWins() + 1);
            row.setPoints(row.getPoints() + 1);
        } else {
            row.setLosses(row.getLosses() + 1);
        }
    }

    /** Divisiones de la NFL en el orden de la liga, con su nombre en español. */
    private static final List<String> NFL_DIVISIONS = List.of("East", "North", "South", "West");
    private static final Map<String, String> NFL_DIVISION_NAMES = Map.of(
            "East", "Este", "North", "Norte", "South", "Sur", "West", "Oeste");

    /**
     * La tabla de la NFL por divisiones («AFC Este»…«NFC Oeste»), como la publica la liga: ESPN la da así con
     * {@code level=3}, cada división ya ordenada con los desempates de la NFL. Dentro de cada una se reordena
     * solo por porcentaje de victorias (el empate vale media) si ESPN no lo hubiera hecho. Cada fila lleva el
     * nombre corto («Bills») y su puesto en la conferencia para los playoffs. Si ESPN no da divisiones (las
     * conferencias solas), queda una tabla única por porcentaje de victorias. Los puntos son las victorias.
     */
    static List<LeagueStandingDTO> parseNflStandings(JsonNode root) {
        List<LeagueStandingDTO> standings = new ArrayList<>();
        if (root == null) return standings;
        List<JsonNode> tables = new ArrayList<>();
        collectNflTables(root, tables);
        boolean divisions = !tables.isEmpty() && tables.stream().allMatch(table -> nflDivision(table) != null);
        if (divisions) {
            tables.sort(Comparator.comparing(table -> nflDivisionOrder(table.path("name").asText(""))));
            for (JsonNode table : tables) {
                List<LeagueStandingDTO> rows = new ArrayList<>();
                for (JsonNode entry : table.path("standings").path("entries")) rows.add(nflRow(entry, nflDivision(table)));
                rows.sort(Comparator.comparingDouble(CompetitionService::winShare).reversed());
                for (int i = 0; i < rows.size(); i++) rows.get(i).setRank(i + 1);
                standings.addAll(rows);
            }
            return standings;
        }
        for (JsonNode table : tables) {
            for (JsonNode entry : table.path("standings").path("entries")) standings.add(nflRow(entry, null));
        }
        standings.sort(Comparator.comparingDouble(CompetitionService::winShare).reversed()
                .thenComparing(Comparator.comparingInt(LeagueStandingDTO::getGoalDiff).reversed())
                .thenComparing(Comparator.comparingInt(LeagueStandingDTO::getGoalsFor).reversed()));
        for (int i = 0; i < standings.size(); i++) standings.get(i).setRank(i + 1);
        return standings;
    }

    /** Tablas con equipos de la respuesta de ESPN: las divisiones o, sin ellas, las conferencias. */
    private static void collectNflTables(JsonNode node, List<JsonNode> tables) {
        if (node.path("standings").path("entries").size() > 0) {
            tables.add(node);
            return;
        }
        for (JsonNode child : node.path("children")) collectNflTables(child, tables);
    }

    /** «AFC East» → «AFC Este»; null si la tabla no es una división de la NFL. */
    static String nflDivision(JsonNode table) {
        String[] parts = table.path("name").asText("").trim().split("\\s+");
        if (parts.length != 2 || !(parts[0].equals("AFC") || parts[0].equals("NFC"))) return null;
        String division = NFL_DIVISION_NAMES.get(parts[1]);
        return division == null ? null : parts[0] + " " + division;
    }

    private static int nflDivisionOrder(String name) {
        String[] parts = name.trim().split("\\s+");
        int conference = parts[0].equals("AFC") ? 0 : 1;
        return conference * NFL_DIVISIONS.size() + NFL_DIVISIONS.indexOf(parts[parts.length - 1]);
    }

    private static LeagueStandingDTO nflRow(JsonNode entry, String division) {
        Map<String, Integer> stats = new HashMap<>();
        for (JsonNode stat : entry.path("stats")) {
            stats.put(stat.path("name").asText(""), stat.path("value").asInt(0));
        }
        int wins = stats.getOrDefault("wins", 0);
        int losses = stats.getOrDefault("losses", 0);
        int ties = stats.getOrDefault("ties", 0);
        int seed = stats.getOrDefault("playoffSeed", 0);
        JsonNode team = entry.path("team");
        return LeagueStandingDTO.builder()
                .group(division)
                .teamName(team.path("displayName").asText(team.path("name").asText("Equipo")))
                .teamShortName(team.path("shortDisplayName").asText(null))
                .teamLogo(team.path("logos").path(0).path("href").asText(null))
                .playoffSeed(seed > 0 ? seed : null)
                .points(wins)
                .gamesPlayed(wins + losses + ties)
                .wins(wins)
                .ties(ties)
                .losses(losses)
                .goalDiff(stats.getOrDefault("pointDifferential", 0))
                .goalsFor(stats.getOrDefault("pointsFor", 0))
                .goalsAgainst(stats.getOrDefault("pointsAgainst", 0))
                .build();
    }

    private static double winShare(LeagueStandingDTO row) {
        return row.getGamesPlayed() == 0 ? 0 : (row.getWins() + row.getTies() / 2.0) / row.getGamesPlayed();
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
