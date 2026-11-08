package com.porra.mundial.service.formulaone;

import com.porra.mundial.dto.RaceClassificationDTO;
import com.porra.mundial.model.Match;
import com.porra.mundial.model.MatchStatusNormalized;
import com.porra.mundial.model.RaceDriver;
import com.porra.mundial.model.RaceWeekend;
import com.porra.mundial.repository.RaceDriverRepository;
import com.porra.mundial.repository.RaceWeekendRepository;
import com.porra.mundial.sports.EspnFormulaOneClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Clasificación completa de las carreras de Fórmula 1: puesto, parrilla, vueltas, tiempo o diferencia,
 * abandonos, puntos y vuelta rápida de cada piloto. ESPN la da piloto a piloto (dos consultas por piloto),
 * así que se pide una sola vez, al acabar la carrera o la primera vez que alguien la abre, y se guarda en
 * {@code race_weekends.classification}.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class RaceClassificationService {

    /** Consultas a ESPN a la vez al cargar una clasificación. */
    private static final int PARALLEL_REQUESTS = 6;
    private static final ExecutorService POOL = Executors.newFixedThreadPool(PARALLEL_REQUESTS, runnable -> {
        Thread thread = new Thread(runnable, "f1-classification");
        thread.setDaemon(true);
        return thread;
    });
    private static final TypeReference<List<Stored>> STORED_LIST = new TypeReference<>() {};

    private final EspnFormulaOneClient espn;
    private final RaceWeekendRepository raceWeekendRepository;
    private final RaceDriverRepository raceDriverRepository;
    private final ObjectMapper objectMapper;

    /**
     * Lo que se guarda de cada piloto: lo de ESPN, con la escudería de esa carrera y sin el nombre (sale
     * de {@code race_drivers}).
     */
    record Stored(int position, String athleteId, String team, String teamColor, String number, Integer grid,
                  Integer laps, String time, String gap, Integer lapsBehind, String status, Integer points,
                  boolean fastestLap) {}

    /** Clasificación de un Gran Premio; la pide a ESPN si la carrera ha acabado y aún no está guardada. */
    public RaceClassificationDTO classification(Match match) {
        RaceWeekend weekend = match == null || match.getId() == null ? null
                : raceWeekendRepository.findById(match.getId()).orElse(null);
        if (weekend == null) return RaceClassificationDTO.NONE;
        List<Stored> rows = read(weekend.getClassification());
        if (rows.isEmpty() && match.getStatus() == MatchStatusNormalized.FINISHED) {
            rows = refresh(match, weekend);
        }
        return rows.isEmpty() ? RaceClassificationDTO.NONE : new RaceClassificationDTO(true, withDrivers(rows));
    }

    /**
     * Pide la clasificación a ESPN y la guarda. Sin la sesión de carrera o si ESPN no responde, no guarda
     * nada y se vuelve a intentar la próxima vez.
     *
     * @return la clasificación guardada, o vacía
     */
    public synchronized List<Stored> refresh(Match match, RaceWeekend weekend) {
        // Otra petición pudo cargarla mientras esta esperaba.
        RaceWeekend current = raceWeekendRepository.findById(weekend.getMatchId()).orElse(weekend);
        List<Stored> saved = read(current.getClassification());
        if (!saved.isEmpty()) return saved;
        String eventId = match.getExternalId() == null ? null
                : match.getExternalId().replace(FormulaOneSyncService.MATCH_PREFIX, "");
        String raceId = current.getRaceSessionId();
        if (eventId == null || !eventId.matches("\\d{1,20}") || raceId == null || !raceId.matches("\\d{1,20}")) {
            return List.of();
        }
        List<Stored> rows;
        try {
            rows = load(eventId, raceId);
        } catch (Exception error) {
            log.info("Fórmula 1: sin clasificación de {} ({})", match.getRound(), error.getMessage());
            return List.of();
        }
        if (rows.isEmpty()) return List.of();
        current.setClassification(objectMapper.writeValueAsString(rows));
        raceWeekendRepository.save(current);
        return rows;
    }

    private List<Stored> load(String eventId, String raceId) throws Exception {
        List<JsonNode> competitors = new ArrayList<>();
        espn.sessionCompetitors(eventId, raceId).forEach(competitors::add);
        competitors.removeIf(c -> c.path("order").asInt(0) <= 0 || !c.path("id").asText("").matches("\\d{1,20}"));
        if (competitors.isEmpty()) return List.of();
        List<CompletableFuture<Stored>> futures = competitors.stream()
                .map(c -> CompletableFuture.supplyAsync(() -> row(eventId, raceId, c), POOL))
                .toList();
        List<Stored> rows = futures.stream().map(CompletableFuture::join).filter(Objects::nonNull)
                .sorted(Comparator.comparingInt(Stored::position)).toList();
        // Mejor reintentar más tarde que guardar una clasificación a medias.
        if (rows.size() < competitors.size()) {
            throw new IllegalStateException("ESPN no dio los datos de " + (competitors.size() - rows.size()) + " pilotos");
        }
        return rows;
    }

    private Stored row(String eventId, String raceId, JsonNode competitor) {
        String athleteId = competitor.path("id").asText();
        try {
            Map<String, JsonNode> stats = stats(espn.competitorStatistics(eventId, raceId, athleteId));
            String status = status(espn.competitorStatus(eventId, raceId, athleteId).path("type").path("name").asText(""));
            return toRow(competitor, stats, status);
        } catch (Exception error) {
            log.debug("Fórmula 1: sin datos del piloto {} en {}: {}", athleteId, eventId, error.getMessage());
            return null;
        }
    }

    static Stored toRow(JsonNode competitor, Map<String, JsonNode> stats, String status) {
        int position = competitor.path("order").asInt();
        JsonNode start = competitor.path("startOrder");
        Integer grid = start.isNumber() && start.asInt() > 0 ? start.asInt() : null;
        Integer lapsBehind = integer(stats.get("behindLaps"));
        boolean finished = "FINISHED".equals(status);
        boolean lapped = lapsBehind != null && lapsBehind > 0;
        JsonNode vehicle = competitor.path("vehicle");
        String color = vehicle.path("teamColor").asText("");
        String number = vehicle.path("number").asText("");
        return new Stored(position, competitor.path("id").asText(), text(vehicle.path("manufacturer"), 100),
                color.matches("[0-9A-Fa-f]{6}") ? color.toUpperCase(java.util.Locale.ROOT) : null,
                number.matches("\\d{1,4}") ? number : null, grid, integer(stats.get("lapsCompleted")),
                finished && position == 1 ? text(stats.get("totalTime")) : null,
                finished && position > 1 && !lapped ? text(stats.get("behindTime")) : null,
                finished && lapped ? lapsBehind : null,
                status, integer(stats.get("championshipPts")), text(stats.get("fastestLap")) != null);
    }

    /** Estado de ESPN reducido a los que se enseñan. */
    static String status(String espnName) {
        String name = espnName == null ? "" : espnName.toUpperCase(java.util.Locale.ROOT);
        if (name.contains("DISQUALIFIED") || name.contains("DSQ")) return "DISQUALIFIED";
        if (name.contains("NOT_START") || name.contains("DNS") || name.contains("WITHDRAWN")) return "DID_NOT_START";
        if (name.contains("RETIRED") || name.contains("DNF") || name.contains("ACCIDENT")) return "RETIRED";
        if (name.contains("CLASSIFIED") || name.contains("FINAL") || name.contains("FINISHED")) return "FINISHED";
        return "OTHER";
    }

    private static Map<String, JsonNode> stats(JsonNode categories) {
        Map<String, JsonNode> byName = new HashMap<>();
        for (JsonNode category : categories) {
            for (JsonNode stat : category.path("stats")) {
                byName.putIfAbsent(stat.path("name").asText(""), stat);
            }
        }
        return byName;
    }

    private static String text(JsonNode node, int max) {
        String value = node.asText("").trim();
        return value.isEmpty() ? null : value.length() > max ? value.substring(0, max) : value;
    }

    private static String text(JsonNode stat) {
        if (stat == null) return null;
        String value = stat.path("displayValue").asText("").trim();
        return value.isEmpty() || value.length() > 20 ? null : value;
    }

    private static Integer integer(JsonNode stat) {
        if (stat == null || !stat.path("value").isNumber()) return null;
        return (int) Math.round(stat.path("value").asDouble());
    }

    private List<Stored> read(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return objectMapper.readValue(json, STORED_LIST);
        } catch (RuntimeException error) {
            log.warn("Fórmula 1: clasificación guardada ilegible ({})", error.getMessage());
            return List.of();
        }
    }

    private List<RaceClassificationDTO.Row> withDrivers(List<Stored> rows) {
        Map<String, RaceDriver> drivers = raceDriverRepository
                .findByExternalIdIn(rows.stream().map(Stored::athleteId).toList()).stream()
                .collect(Collectors.toMap(RaceDriver::getExternalId, Function.identity(), (a, b) -> a));
        return rows.stream().map(row -> {
            RaceDriver driver = drivers.get(row.athleteId());
            return new RaceClassificationDTO.Row(row.position(), driver == null ? null : driver.getId(),
                    driver == null ? "Piloto" : driver.getName(),
                    row.team() != null ? row.team() : driver == null ? null : driver.getTeamName(),
                    row.teamColor() != null ? row.teamColor() : driver == null ? null : driver.getTeamColor(),
                    row.number() != null ? row.number() : driver == null ? null : driver.getCarNumber(), row.grid(), row.laps(), row.time(), row.gap(),
                    row.lapsBehind(), row.status(), row.points(), row.fastestLap());
        }).toList();
    }
}
