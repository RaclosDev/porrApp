package app.porrapp.service.formulaone;

import app.porrapp.dto.FormulaOneStandingsDTO;
import app.porrapp.model.RaceDriver;
import app.porrapp.repository.RaceDriverRepository;
import app.porrapp.sports.EspnFormulaOneClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Mundial de pilotos y de constructores. Es una sola consulta a ESPN y se guarda en la caché (10 minutos),
 * así que no hace falta copiarlo a la base de datos.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class FormulaOneStandingsService {

    private final EspnFormulaOneClient espn;
    private final RaceDriverRepository raceDriverRepository;

    /**
     * @param season año de una temporada ya archivada (su Mundial ya no cambia), o null para la que está en curso
     */
    @Cacheable(value = "f1Standings", key = "#season == null ? 'current' : #season", sync = true)
    public FormulaOneStandingsDTO standings(Integer season) {
        JsonNode children;
        try {
            children = espn.standings(season);
        } catch (Exception error) {
            log.info("Fórmula 1: sin Mundial de ESPN ({})", error.getMessage());
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "No se pudo cargar el Mundial. Inténtalo en un rato.");
        }
        JsonNode driverTable = null;
        JsonNode constructorTable = null;
        for (JsonNode child : children) {
            String name = child.path("name").asText("").toLowerCase();
            if (name.contains("driver")) driverTable = child.path("standings");
            else if (name.contains("constructor")) constructorTable = child.path("standings");
        }
        return parse(driverTable, constructorTable, teamsByExternalId(driverTable));
    }

    private Map<String, RaceDriver> teamsByExternalId(JsonNode driverTable) {
        List<String> ids = new ArrayList<>();
        if (driverTable != null) {
            driverTable.path("entries").forEach(e -> ids.add(e.path("athlete").path("id").asText("")));
        }
        return raceDriverRepository.findByExternalIdIn(ids).stream()
                .collect(Collectors.toMap(RaceDriver::getExternalId, Function.identity(), (a, b) -> a));
    }

    static FormulaOneStandingsDTO parse(JsonNode driverTable, JsonNode constructorTable, Map<String, RaceDriver> known) {
        String season = null;
        List<FormulaOneStandingsDTO.DriverRow> drivers = new ArrayList<>();
        if (driverTable != null) {
            season = driverTable.path("season").asText(null);
            for (JsonNode entry : driverTable.path("entries")) {
                JsonNode athlete = entry.path("athlete");
                String name = text(athlete.path("displayName"));
                if (name == null) continue;
                RaceDriver driver = known.get(athlete.path("id").asText(""));
                String flag = text(athlete.path("flag").path("href"));
                drivers.add(new FormulaOneStandingsDTO.DriverRow(stat(entry, "rank"), name,
                        text(athlete.path("shortName")), text(athlete.path("abbreviation")),
                        RacePlaces.country(text(athlete.path("flag").path("alt"))),
                        flag != null && flag.startsWith("https://") ? flag : null,
                        driver == null ? null : driver.getTeamName(),
                        driver == null ? null : driver.getTeamColor(),
                        stat(entry, "championshipPts")));
            }
        }
        List<FormulaOneStandingsDTO.ConstructorRow> constructors = new ArrayList<>();
        if (constructorTable != null) {
            if (season == null) season = constructorTable.path("season").asText(null);
            for (JsonNode entry : constructorTable.path("entries")) {
                JsonNode team = entry.path("team");
                String name = text(team.path("displayName"));
                if (name == null) continue;
                String color = team.path("color").asText("");
                constructors.add(new FormulaOneStandingsDTO.ConstructorRow(stat(entry, "rank"), name,
                        color.matches("[0-9A-Fa-f]{6}") ? color.toUpperCase() : null, stat(entry, "points")));
            }
        }
        return new FormulaOneStandingsDTO(season, drivers, constructors);
    }

    /** Valor entero de una estadística del Mundial («rank», «points»…), o 0 si no está. */
    private static int stat(JsonNode entry, String name) {
        for (JsonNode stat : entry.path("stats")) {
            if (name.equals(stat.path("name").asText()) && !stat.has("id")) {
                return (int) Math.round(stat.path("value").asDouble(0));
            }
        }
        return 0;
    }

    private static String text(JsonNode node) {
        String value = node == null ? null : node.asText(null);
        return value == null || value.isBlank() ? null : value.trim();
    }
}
