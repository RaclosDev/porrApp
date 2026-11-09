package app.porrapp.service.formulaone;

import app.porrapp.model.Competition;
import app.porrapp.model.Match;
import app.porrapp.model.MatchStatusNormalized;
import app.porrapp.model.RaceDriver;
import app.porrapp.model.RaceWeekend;
import app.porrapp.repository.MatchPredictionRepository;
import app.porrapp.repository.MatchRepository;
import app.porrapp.repository.RaceDriverRepository;
import app.porrapp.repository.RaceWeekendRepository;
import app.porrapp.sports.EspnFormulaOneClient;
import app.porrapp.util.AppTime;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Carga la Fórmula 1 desde ESPN: cada Gran Premio es un {@link Match} sin equipos (su fecha es la de la
 * clasificación, cuando se cierra la predicción) con su {@link RaceWeekend}; los pilotos van a
 * {@link RaceDriver}. Al acabar la carrera guarda podio, pole y vuelta rápida, puntúa y avisa.
 * <ul>
 *   <li>{@link #importSeason}: la temporada entera (al crear una liga y en la barrida diaria de las 5:00).</li>
 *   <li>{@link #sync}: sincronización cada 15 minutos; el Gran Premio en curso o el siguiente y, si falta,
 *   la temporada entera.</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class FormulaOneSyncService {

    /** Prefijo del id externo de los Grandes Premios en {@code matches}. */
    public static final String MATCH_PREFIX = "f1:";
    /**
     * Resultados de carreras más antiguas sin predicciones: se guarda el podio, pero no se pide la vuelta
     * rápida ni las escuderías (una consulta por piloto), ni se avisa.
     */
    static final Duration RECENT = Duration.ofDays(10);

    private final EspnFormulaOneClient espn;
    private final MatchRepository matchRepository;
    private final RaceWeekendRepository raceWeekendRepository;
    private final RaceDriverRepository raceDriverRepository;
    private final MatchPredictionRepository matchPredictionRepository;
    private final GrandPrixScoringService scoringService;
    private final GrandPrixResultNotifier resultNotifier;
    private final RaceClassificationService classificationService;

    /**
     * Cada cuánto la sincronización periódica vuelve a cargar la temporada entera aunque ya la tenga
     * (cambios de calendario); entre medias solo mira el Gran Premio en curso.
     */
    static final Duration SEASON_REFRESH = Duration.ofHours(6);

    /**
     * Última carga completa de la temporada, o null si no la hay en este proceso o la última falló. La
     * sincronización del Gran Premio en curso guarda ese Gran Premio, así que la competición nunca está
     * vacía y no se puede usar «no tiene partidos» para saber si falta el calendario.
     */
    private volatile Instant seasonLoadedAt;

    /** Lo que ha cambiado en una pasada. */
    public record SyncResult(int grandsPrix, int updated, boolean resultsChanged) {}

    /**
     * Pasada de la sincronización periódica: la temporada entera si falta (al arrancar, tras una carga
     * fallida o cada {@link #SEASON_REFRESH}) y, si no, solo el Gran Premio en curso.
     */
    public SyncResult sync(Competition competition) throws Exception {
        Instant loaded = seasonLoadedAt;
        if (loaded == null || loaded.isBefore(Instant.now().minus(SEASON_REFRESH))) {
            return importSeason(competition);
        }
        return syncCurrent(competition);
    }

    /** Temporada en curso y, desde noviembre, la siguiente si ESPN ya la tiene. */
    public synchronized SyncResult importSeason(Competition competition) throws Exception {
        if (!espn.isAvailable()) {
            seasonLoadedAt = null;
            throw new IllegalStateException("Circuit breaker abierto");
        }
        int year = LocalDate.now(AppTime.ZONE).getYear();
        Totals totals = new Totals();
        JsonNode season;
        try {
            season = espn.seasonEvents(year);
        } catch (Exception error) {
            // Sin calendario: la siguiente pasada periódica lo vuelve a intentar.
            seasonLoadedAt = null;
            throw error;
        }
        process(competition, season, totals);
        seasonLoadedAt = Instant.now();
        if (LocalDate.now(AppTime.ZONE).getMonthValue() >= 11) {
            try {
                process(competition, espn.seasonEvents(year + 1), totals);
            } catch (Exception error) {
                log.info("Fórmula 1: la temporada {} aún no está en ESPN ({})", year + 1, error.getMessage());
            }
        }
        return totals.result();
    }

    /** Gran Premio en curso o el siguiente: una sola consulta. */
    public synchronized SyncResult syncCurrent(Competition competition) throws Exception {
        if (!espn.isAvailable()) throw new IllegalStateException("Circuit breaker abierto");
        Totals totals = new Totals();
        process(competition, espn.currentEvents(), totals);
        return totals.result();
    }

    private void process(Competition competition, JsonNode events, Totals totals) {
        for (JsonNode event : events) {
            try {
                Outcome outcome = processEvent(competition, event);
                if (outcome.changed()) totals.updated++;
                totals.resultsChanged |= outcome.scored();
                totals.grandsPrix++;
            } catch (RuntimeException error) {
                log.warn("Fórmula 1: no se pudo cargar el evento {}: {}", event.path("id").asText(), error.getMessage());
            }
        }
    }

    /** Si cambió algo del Gran Premio y si se puntuó su resultado. */
    record Outcome(boolean changed, boolean scored) {
        static final Outcome NONE = new Outcome(false, false);
    }

    /** Sesiones de un Gran Premio que interesan. */
    record Sessions(JsonNode qualifying, JsonNode race, boolean sprint) {
        static Sessions of(JsonNode event) {
            JsonNode qualifying = null;
            JsonNode race = null;
            boolean sprint = false;
            for (JsonNode session : event.path("competitions")) {
                String type = session.path("type").path("abbreviation").asText("");
                if ("Qual".equalsIgnoreCase(type)) qualifying = session;
                else if ("Race".equalsIgnoreCase(type)) race = session;
                else if ("SR".equalsIgnoreCase(type)) sprint = true;
            }
            return new Sessions(qualifying, race, sprint);
        }
    }

    Outcome processEvent(Competition competition, JsonNode event) {
        String eventId = event.path("id").asText("");
        Sessions sessions = Sessions.of(event);
        if (!eventId.matches("\\d{1,20}") || sessions.race() == null) return Outcome.NONE;

        Instant raceAt = instant(sessions.race().path("date").asText(null));
        Instant qualifyingAt = sessions.qualifying() == null ? null : instant(sessions.qualifying().path("date").asText(null));
        Instant lockAt = qualifyingAt != null ? qualifyingAt : raceAt;
        MatchStatusNormalized status = status(sessions);
        boolean finished = status == MatchStatusNormalized.FINISHED;

        Match match = matchRepository.findByExternalId(MATCH_PREFIX + eventId).orElseGet(() -> Match.builder()
                .externalId(MATCH_PREFIX + eventId)
                .competition(competition)
                .build());
        String round = GrandPrixNames.spanish(event.path("name").asText(null));
        boolean matchChanged = match.getId() == null
                || !Objects.equals(match.getRound(), round)
                || !Objects.equals(match.getMatchDate(), lockAt)
                || match.getStatus() != status
                || !Objects.equals(match.getFinished(), finished);
        if (matchChanged) {
            match.setCompetition(competition);
            match.setRound(round);
            match.setMatchDate(lockAt);
            match.setStatus(status);
            match.setFinished(finished);
            match = matchRepository.save(match);
        }

        RaceWeekend weekend = raceWeekendRepository.findById(match.getId())
                .orElseGet(RaceWeekend::new);
        boolean weekendChanged = weekend.getMatchId() == null;
        weekend.setMatchId(match.getId());
        JsonNode circuit = event.path("circuit");
        weekendChanged |= set(weekend.getRaceAt(), raceAt, weekend::setRaceAt);
        weekendChanged |= set(weekend.getCircuit(), text(circuit.path("fullName"), 150), weekend::setCircuit);
        weekendChanged |= set(weekend.getCity(), text(circuit.path("address").path("city"), 100), weekend::setCity);
        weekendChanged |= set(weekend.getCountry(), text(circuit.path("address").path("country"), 100), weekend::setCountry);
        String raceSessionId = sessions.race().path("id").asText("");
        if (raceSessionId.matches("\\d{1,20}")) {
            weekendChanged |= set(weekend.getRaceSessionId(), raceSessionId, weekend::setRaceSessionId);
        }
        if (weekend.isSprint() != sessions.sprint()) {
            weekend.setSprint(sessions.sprint());
            weekendChanged = true;
        }

        // Pilotos inscritos: los de la carrera si ya están, si no los de la clasificación.
        JsonNode entrants = sessions.race().path("competitors");
        if (!entrants.isArray() || entrants.isEmpty()) {
            entrants = sessions.qualifying() == null ? entrants : sessions.qualifying().path("competitors");
        }
        Map<String, RaceDriver> drivers = upsertDrivers(entrants);
        String entryList = RaceWeekend.entryList(ordered(entrants).stream()
                .map(c -> drivers.get(c.path("id").asText()))
                .filter(Objects::nonNull)
                .map(RaceDriver::getId)
                .toList());
        boolean entryListChanged = entryList != null && !entryList.equals(weekend.getEntryList());
        if (entryListChanged) {
            weekend.setEntryList(entryList);
            weekendChanged = true;
        }

        boolean recent = raceAt != null && raceAt.isAfter(Instant.now().minus(RECENT));
        boolean predicted = match.getId() != null && matchPredictionRepository.countByMatchId(match.getId()) > 0;

        // Pole: en cuanto acaba la clasificación.
        Long pole = null;
        if (sessions.qualifying() != null && completed(sessions.qualifying())) {
            pole = driverAt(sessions.qualifying(), 1, drivers);
        }
        Long first = null, second = null, third = null, fastestLap = weekend.getFastestLapDriverId();
        if (finished) {
            first = driverAt(sessions.race(), 1, drivers);
            second = driverAt(sessions.race(), 2, drivers);
            third = driverAt(sessions.race(), 3, drivers);
            if (first == null || second == null || third == null) {
                // Carrera terminada sin clasificación publicada todavía: se espera a la siguiente pasada.
                finished = false;
                first = second = third = null;
            }
        }
        if (finished) {
            boolean podiumChanged = !Objects.equals(first, weekend.getFirstDriverId())
                    || !Objects.equals(second, weekend.getSecondDriverId())
                    || !Objects.equals(third, weekend.getThirdDriverId());
            if ((recent || predicted) && (fastestLap == null || podiumChanged)) {
                fastestLap = fastestLap(eventId, sessions.race(), drivers);
                if (fastestLap == null) fastestLap = weekend.getFastestLapDriverId();
            }
        }
        // Escuderías y dorsales: con la lista de inscritos nueva o al acabar una carrera reciente.
        if ((entryListChanged || (finished && weekend.getResultsAt() == null)) && recent) {
            refreshTeams(eventId, sessions.race().path("competitors").isEmpty() ? sessions.qualifying() : sessions.race(), drivers);
        }

        boolean resultsChanged = !Objects.equals(pole, weekend.getPoleDriverId()) && pole != null
                || finished && (!Objects.equals(first, weekend.getFirstDriverId())
                || !Objects.equals(second, weekend.getSecondDriverId())
                || !Objects.equals(third, weekend.getThirdDriverId())
                || !Objects.equals(fastestLap, weekend.getFastestLapDriverId()));
        if (resultsChanged) {
            if (pole != null) weekend.setPoleDriverId(pole);
            if (finished) {
                weekend.setFirstDriverId(first);
                weekend.setSecondDriverId(second);
                weekend.setThirdDriverId(third);
                weekend.setFastestLapDriverId(fastestLap);
                if (weekend.hasPodium()) weekend.setResultsAt(Instant.now());
            }
            weekendChanged = true;
        }
        if (weekendChanged) weekend = raceWeekendRepository.save(weekend);

        boolean scoredNow = resultsChanged && finished && weekend.hasPodium();
        if (scoredNow) {
            int scored = scoringService.scoreWeekend(match, weekend);
            log.info("Fórmula 1: resultados de {} guardados ({} predicciones puntuadas)", round, scored);
            if (weekend.getResultsNotifiedAt() == null) {
                if (recent) {
                    try {
                        resultNotifier.notifyResult(match, weekend);
                    } catch (RuntimeException error) {
                        log.warn("Fórmula 1: no se pudo avisar del resultado de {}: {}", round, error.getMessage());
                    }
                }
                weekend.setResultsNotifiedAt(Instant.now());
                raceWeekendRepository.save(weekend);
            }
        }
        // Clasificación completa de una carrera reciente: se deja guardada para quien la abra.
        if (finished && recent && weekend.hasPodium() && weekend.getClassification() == null) {
            try {
                classificationService.refresh(match, weekend);
            } catch (RuntimeException error) {
                log.info("Fórmula 1: sin clasificación completa de {}: {}", round, error.getMessage());
            }
        }
        return new Outcome(matchChanged || weekendChanged, scoredNow);
    }

    private static MatchStatusNormalized status(Sessions sessions) {
        JsonNode raceStatus = sessions.race().path("status").path("type");
        String name = raceStatus.path("name").asText("");
        if (name.contains("CANCEL")) return MatchStatusNormalized.CANCELLED;
        if (name.contains("POSTPONED")) return MatchStatusNormalized.POSTPONED;
        if (raceStatus.path("completed").asBoolean(false) && "post".equals(raceStatus.path("state").asText())) {
            return MatchStatusNormalized.FINISHED;
        }
        if ("in".equals(raceStatus.path("state").asText())) return MatchStatusNormalized.LIVE;
        if (sessions.qualifying() != null) {
            String qualifyingState = sessions.qualifying().path("status").path("type").path("state").asText("");
            // El fin de semana ya ha empezado a decidirse: la predicción está cerrada.
            if ("in".equals(qualifyingState) || "post".equals(qualifyingState)) return MatchStatusNormalized.LIVE;
        }
        return MatchStatusNormalized.SCHEDULED;
    }

    private static boolean completed(JsonNode session) {
        JsonNode type = session.path("status").path("type");
        return type.path("completed").asBoolean(false) && "post".equals(type.path("state").asText());
    }

    /** Competidores con orden, del primero al último (los que aún no lo tienen, al final). */
    private static List<JsonNode> ordered(JsonNode competitors) {
        List<JsonNode> list = new ArrayList<>();
        if (competitors != null && competitors.isArray()) competitors.forEach(list::add);
        list.sort(Comparator.comparingInt(c -> c.path("order").asInt(Integer.MAX_VALUE)));
        return list;
    }

    private static Long driverAt(JsonNode session, int position, Map<String, RaceDriver> drivers) {
        for (JsonNode competitor : session.path("competitors")) {
            if (competitor.path("order").asInt(-1) == position) {
                RaceDriver driver = drivers.get(competitor.path("id").asText());
                return driver == null ? null : driver.getId();
            }
        }
        return null;
    }

    /** Crea o actualiza los pilotos de una sesión; devuelve los pilotos por id de ESPN. */
    private Map<String, RaceDriver> upsertDrivers(JsonNode competitors) {
        Map<String, RaceDriver> byExternalId = new HashMap<>();
        if (competitors == null || !competitors.isArray() || competitors.isEmpty()) return byExternalId;
        List<String> ids = new ArrayList<>();
        competitors.forEach(c -> ids.add(c.path("id").asText()));
        raceDriverRepository.findByExternalIdIn(ids).forEach(d -> byExternalId.put(d.getExternalId(), d));
        for (JsonNode competitor : competitors) {
            String id = competitor.path("id").asText("");
            JsonNode athlete = competitor.path("athlete");
            String name = text(athlete.path("displayName"), 100);
            if (!id.matches("\\d{1,30}") || name == null) continue;
            RaceDriver driver = byExternalId.getOrDefault(id, RaceDriver.builder().externalId(id).build());
            boolean changed = driver.getId() == null;
            changed |= set(driver.getName(), name, driver::setName);
            changed |= set(driver.getShortName(), text(athlete.path("shortName"), 60), driver::setShortName);
            changed |= set(driver.getCountry(), text(athlete.path("flag").path("alt"), 60), driver::setCountry);
            String flag = text(athlete.path("flag").path("href"), 500);
            if (flag != null && flag.startsWith("https://")) changed |= set(driver.getFlagUrl(), flag, driver::setFlagUrl);
            if (changed) {
                driver.setUpdatedAt(Instant.now());
                driver = raceDriverRepository.save(driver);
            }
            byExternalId.put(id, driver);
        }
        return byExternalId;
    }

    private void refreshTeams(String eventId, JsonNode session, Map<String, RaceDriver> drivers) {
        if (session == null) return;
        try {
            for (JsonNode item : espn.sessionCompetitors(eventId, session.path("id").asText())) {
                RaceDriver driver = drivers.get(item.path("id").asText());
                JsonNode vehicle = item.path("vehicle");
                if (driver == null || vehicle.isMissingNode()) continue;
                boolean changed = set(driver.getTeamName(), text(vehicle.path("manufacturer"), 100), driver::setTeamName);
                String color = vehicle.path("teamColor").asText("");
                if (color.matches("[0-9A-Fa-f]{6}")) changed |= set(driver.getTeamColor(), color.toUpperCase(), driver::setTeamColor);
                String number = vehicle.path("number").asText("");
                if (number.matches("\\d{1,4}")) changed |= set(driver.getCarNumber(), number, driver::setCarNumber);
                if (changed) {
                    driver.setUpdatedAt(Instant.now());
                    raceDriverRepository.save(driver);
                }
            }
        } catch (Exception error) {
            // Secundario: sin escuderías la predicción sigue funcionando.
            log.info("Fórmula 1: sin escuderías del evento {}: {}", eventId, error.getMessage());
        }
    }

    private Long fastestLap(String eventId, JsonNode race, Map<String, RaceDriver> drivers) {
        List<String> order = ordered(race.path("competitors")).stream().map(c -> c.path("id").asText()).toList();
        try {
            String athlete = espn.fastestLapAthlete(eventId, race.path("id").asText(), order);
            RaceDriver driver = athlete == null ? null : drivers.get(athlete);
            return driver == null ? null : driver.getId();
        } catch (Exception error) {
            // La vuelta rápida es secundaria: si falla, se reintenta en la siguiente pasada.
            log.info("Fórmula 1: sin vuelta rápida del evento {}: {}", eventId, error.getMessage());
            return null;
        }
    }

    private static <T> boolean set(T current, T next, java.util.function.Consumer<T> setter) {
        if (Objects.equals(current, next)) return false;
        setter.accept(next);
        return true;
    }

    private static String text(JsonNode node, int max) {
        String value = node == null ? null : node.asText(null);
        if (value == null || value.isBlank()) return null;
        value = value.trim();
        return value.length() > max ? value.substring(0, max) : value;
    }

    private static Instant instant(String iso) {
        if (iso == null || iso.isBlank()) return null;
        try {
            // ESPN da "2026-11-08T17:00Z", sin segundos.
            return Instant.parse(iso.length() == 17 ? iso.replace("Z", ":00Z") : iso);
        } catch (RuntimeException error) {
            return null;
        }
    }

    private static final class Totals {
        int grandsPrix;
        int updated;
        boolean resultsChanged;

        SyncResult result() {
            return new SyncResult(grandsPrix, updated, resultsChanged);
        }
    }
}
