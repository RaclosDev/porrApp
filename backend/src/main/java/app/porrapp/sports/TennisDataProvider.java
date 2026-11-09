package app.porrapp.sports;

import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Torneos de tenis desde la API pública de ESPN.
 * <p>
 * Cada torneo es un evento del circuito ({@code 172-2026}: Roland Garros 2026) con todos sus partidos
 * agrupados por cuadro. Se pronostica desde octavos: solo se traducen los partidos de octavos (la última
 * ronda numerada del cuadro, con ocho partidos), cuartos, semifinales y final, y la fase de grupos de las
 * ATP Finals. Cada partido sale en el formato de evento de ESPN fútbol para que {@code MatchEventProcessor}
 * lo guarde como cualquier otro: el marcador son los sets ganados (3-1) y los jugadores son equipos.
 * <p>
 * Una retirada o un W.O. dan ganador pero no marcador: los sets no reflejan un partido completo.
 */
@Component
@Slf4j
public class TennisDataProvider implements SportsDataProvider {

    /** Circuit breaker propio: un fallo del tenis no corta la sincronización del fútbol. */
    public static final String CIRCUIT_BREAKER = "tennisApi";
    /** Prefijo de los ids de partido y de jugador, para no mezclarlos con los de ESPN fútbol. */
    public static final String ID_PREFIX = "tennis-";

    private static final String SITE_URL = "https://site.api.espn.com/apis/site/v2/sports/tennis/";
    private static final String CORE_URL = "https://sports.core.api.espn.com/v2/sports/tennis/leagues/";
    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("yyyyMMdd");
    private static final Pattern NUMBERED_ROUND = Pattern.compile("round (\\d{1,2})");
    /** El calendario de un torneo casi no cambia: se consulta como mucho cada doce horas. */
    private static final Duration EDITION_TTL = Duration.ofHours(12);
    /** La sincronización pide varios días de un mismo torneo: se reutiliza el marcador descargado. */
    private static final Duration EVENT_TTL = Duration.ofSeconds(60);
    /** Margen alrededor de las fechas del torneo: ESPN las da en hora de Nueva York. */
    private static final Duration WINDOW_MARGIN = Duration.ofDays(1);
    /** Un torneo acabado hace poco aún es «el actual» unos días: llegan correcciones de resultados. */
    private static final Duration RECENT = Duration.ofDays(3);
    private static final Set<String> FINISHED = Set.of("STATUS_FINAL", "STATUS_RETIRED", "STATUS_WALKOVER",
            "STATUS_DEFAULT", "STATUS_DEFAULTED", "STATUS_ABANDONED");

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final CircuitBreakerRegistry circuitBreakerRegistry;
    private final Clock clock;
    private final Map<String, Cached<Edition>> editions = new ConcurrentHashMap<>();
    private final Map<String, Cached<JsonNode>> events = new ConcurrentHashMap<>();

    /** Fechas de una edición de un torneo, tal como las da ESPN. */
    public record Edition(String eventId, Instant start, Instant end) {
        boolean contains(Instant moment) {
            return !moment.isBefore(start.minus(WINDOW_MARGIN)) && !moment.isAfter(end.plus(WINDOW_MARGIN));
        }
    }

    private record Cached<T>(T value, Instant fetchedAt) {}

    @Autowired
    public TennisDataProvider(HttpClient httpClient, ObjectMapper objectMapper,
                              CircuitBreakerRegistry circuitBreakerRegistry) {
        this(httpClient, objectMapper, circuitBreakerRegistry, Clock.systemUTC());
    }

    TennisDataProvider(HttpClient httpClient, ObjectMapper objectMapper,
                       CircuitBreakerRegistry circuitBreakerRegistry, Clock clock) {
        this.httpClient = httpClient;
        this.objectMapper = objectMapper;
        this.circuitBreakerRegistry = circuitBreakerRegistry;
        this.clock = clock;
    }

    @Override
    public String getProviderName() {
        return "ESPN tenis";
    }

    @Override
    public boolean supports(String competitionCode) {
        return TennisTournaments.parse(competitionCode).isPresent();
    }

    @Override
    public boolean isAvailable() {
        CircuitBreaker.State state = circuitBreakerRegistry.circuitBreaker(CIRCUIT_BREAKER).getState();
        return state != CircuitBreaker.State.OPEN && state != CircuitBreaker.State.FORCED_OPEN;
    }

    /**
     * Partidos que se pronostican del torneo. {@code dateRange} admite un año (yyyy: la edición de ese
     * año), un día (yyyyMMdd: la edición en curso si ese día se juega) o nada (la edición actual).
     */
    @Override
    public JsonNode fetchScoreboardEvents(String competitionSlug, String dateRange) throws Exception {
        TennisTournaments.Ref ref = ref(competitionSlug);
        Edition edition = editionFor(ref, dateRange);
        ArrayNode result = objectMapper.createArrayNode();
        if (edition == null) return result;
        JsonNode grouping = grouping(ref, edition);
        if (grouping == null) return result;
        Map<String, String> slugs = roundSlugs(grouping.path("competitions"));
        for (JsonNode match : grouping.path("competitions")) {
            String slug = slugs.get(match.path("id").asText(""));
            if (slug != null) result.add(adapt(match, slug));
        }
        return result;
    }

    @Override
    public JsonNode fetchEvent(String competitionSlug, String eventId) throws Exception {
        String id = eventId != null && eventId.startsWith(ID_PREFIX) ? eventId : ID_PREFIX + eventId;
        for (JsonNode event : fetchScoreboardEvents(competitionSlug, null)) {
            if (id.equals(event.path("id").asText())) return event;
        }
        throw new IOException("ESPN no tiene el partido de tenis " + eventId);
    }

    /** Jugadores del cuadro final de la edición actual, para tenerlos antes de que lleguen a octavos. */
    @Override
    public JsonNode fetchTeams(String competitionSlug) throws Exception {
        TennisTournaments.Ref ref = ref(competitionSlug);
        ArrayNode result = objectMapper.createArrayNode();
        Edition edition = currentEdition(ref);
        JsonNode grouping = edition == null ? null : grouping(ref, edition);
        if (grouping == null) return result;
        Map<String, ObjectNode> players = new LinkedHashMap<>();
        for (JsonNode match : grouping.path("competitions")) {
            if (isQualifying(match)) continue;
            for (JsonNode competitor : match.path("competitors")) {
                ObjectNode player = player(competitor);
                if (player != null) players.putIfAbsent(player.path("id").asText(), player);
            }
        }
        players.values().forEach(result::add);
        return result;
    }

    /** Fechas de la edición actual: la que se juega o la próxima publicada; si no, la última. */
    @Override
    public SeasonWindow fetchSeasonWindow(String competitionSlug) throws Exception {
        Edition edition = currentEdition(ref(competitionSlug));
        return edition == null ? null : new SeasonWindow(
                edition.start().minus(WINDOW_MARGIN).toString(), edition.end().plus(WINDOW_MARGIN).toString());
    }

    /**
     * Edición actual del torneo de una competición: la que se está jugando, la próxima ya publicada o, si
     * no hay, la última. Null si ESPN no tiene ninguna.
     */
    public Edition currentEdition(String externalId) throws Exception {
        return currentEdition(ref(externalId));
    }

    private Edition currentEdition(TennisTournaments.Ref ref) throws Exception {
        Instant now = clock.instant();
        int year = now.atZone(ZoneOffset.UTC).getYear();
        Edition thisYear = edition(ref, year);
        if (thisYear != null && !thisYear.end().plus(RECENT).isBefore(now)) return thisYear;
        Edition next = edition(ref, year + 1);
        if (next != null) return next;
        return thisYear != null ? thisYear : edition(ref, year - 1);
    }

    private Edition editionFor(TennisTournaments.Ref ref, String dateRange) throws Exception {
        if (dateRange == null || dateRange.isBlank() || dateRange.contains("-")) return currentEdition(ref);
        if (dateRange.matches("\\d{4}")) return edition(ref, Integer.parseInt(dateRange));
        if (!dateRange.matches("\\d{8}")) return null;
        LocalDate day;
        try {
            day = LocalDate.parse(dateRange, DAY);
        } catch (DateTimeParseException e) {
            return null;
        }
        Edition edition = currentEdition(ref);
        Instant noon = day.atTime(12, 0).toInstant(ZoneOffset.UTC);
        return edition != null && edition.contains(noon) ? edition : null;
    }

    /** Edición de un año ({@code 172-2026}), o null si ESPN no la tiene (aún no publicada). */
    private Edition edition(TennisTournaments.Ref ref, int year) throws Exception {
        String eventId = ref.tournament().espnId() + "-" + year;
        String key = ref.draw().tour + ":" + eventId;
        Cached<Edition> cached = editions.get(key);
        if (cached != null && clock.instant().isBefore(cached.fetchedAt().plus(EDITION_TTL))) return cached.value();
        JsonNode node = get(CORE_URL + ref.draw().tour + "/events/" + eventId);
        Edition edition = null;
        Instant start = node == null ? null : instant(node.path("date").asText(null));
        Instant end = node == null ? null : instant(node.path("endDate").asText(null));
        if (start != null && end != null && end.isAfter(start) && eventId.equals(node.path("id").asText())) {
            edition = new Edition(eventId, start, end);
        }
        editions.put(key, new Cached<>(edition, clock.instant()));
        return edition;
    }

    /** Cuadro individual de la edición en el marcador de ESPN, o null si aún no está. */
    private JsonNode grouping(TennisTournaments.Ref ref, Edition edition) throws Exception {
        JsonNode event = event(ref, edition);
        if (event == null) return null;
        for (JsonNode grouping : event.path("groupings")) {
            if (ref.draw().grouping.equals(grouping.path("grouping").path("slug").asText())) return grouping;
        }
        return null;
    }

    /** El evento del torneo con todos sus partidos: lo trae el marcador de cualquier día del torneo. */
    private JsonNode event(TennisTournaments.Ref ref, Edition edition) throws Exception {
        String key = ref.draw().tour + ":" + edition.eventId();
        Cached<JsonNode> cached = events.get(key);
        if (cached != null && clock.instant().isBefore(cached.fetchedAt().plus(EVENT_TTL))) return cached.value();
        String day = edition.start().atZone(ZoneOffset.UTC).toLocalDate().format(DAY);
        JsonNode root = get(SITE_URL + ref.draw().tour + "/scoreboard?dates=" + day);
        if (root == null) throw new IOException("ESPN no devolvió el marcador de tenis del " + day);
        JsonNode found = null;
        for (JsonNode event : root.path("events")) {
            if (edition.eventId().equals(event.path("id").asText())) found = event;
        }
        events.put(key, new Cached<>(found, clock.instant()));
        return found;
    }

    /**
     * Ronda de cada partido que se pronostica, como {@code season.slug} de ESPN fútbol: octavos es la última
     * ronda numerada («Round 4» en un Grand Slam, «Round 3» en un cuadro de 56) si tiene ocho partidos o menos.
     */
    static Map<String, String> roundSlugs(JsonNode matches) {
        int lastNumbered = 0;
        Map<Integer, Integer> perRound = new LinkedHashMap<>();
        for (JsonNode match : matches) {
            Integer number = roundNumber(match);
            if (number == null) continue;
            perRound.merge(number, 1, Integer::sum);
            lastNumbered = Math.max(lastNumbered, number);
        }
        boolean hasRoundOf16 = lastNumbered > 0 && perRound.get(lastNumbered) <= 8;
        Map<String, String> slugs = new LinkedHashMap<>();
        for (JsonNode match : matches) {
            String id = match.path("id").asText("");
            if (id.isEmpty() || isQualifying(match)) continue;
            String name = roundName(match);
            Integer number = roundNumber(match);
            String slug = switch (name) {
                case "quarterfinal", "quarterfinals", "quarter-final", "quarter-finals" -> "quarterfinals";
                case "semifinal", "semifinals", "semi-final", "semi-finals" -> "semifinals";
                case "final" -> "final";
                default -> name.startsWith("group") || name.startsWith("round robin") ? "round-robin"
                        : hasRoundOf16 && number != null && number == lastNumbered ? "round-of-16" : null;
            };
            if (slug != null) slugs.put(id, slug);
        }
        return slugs;
    }

    private static String roundName(JsonNode match) {
        return match.path("round").path("displayName").asText("").trim().toLowerCase(Locale.ROOT);
    }

    private static Integer roundNumber(JsonNode match) {
        if (isQualifying(match)) return null;
        Matcher matcher = NUMBERED_ROUND.matcher(roundName(match));
        return matcher.matches() ? Integer.valueOf(matcher.group(1)) : null;
    }

    private static boolean isQualifying(JsonNode match) {
        return roundName(match).startsWith("qualifying");
    }

    /** Partido en formato de evento ESPN fútbol: jugadores como equipos y sets ganados como marcador. */
    ObjectNode adapt(JsonNode match, String roundSlug) {
        JsonNode type = match.path("status").path("type");
        String name = type.path("name").asText("");
        boolean finished = FINISHED.contains(name) || (type.path("completed").asBoolean(false)
                && "post".equals(type.path("state").asText()));
        // Retirada, W.O. o descalificación: hay ganador, pero los sets no son los de un partido completo.
        boolean complete = finished && "STATUS_FINAL".equals(name);
        boolean live = !finished && "in".equals(type.path("state").asText());

        ObjectNode statusType = objectMapper.createObjectNode()
                .put("name", finished ? "STATUS_FINAL" : name)
                .put("state", finished ? "post" : type.path("state").asText("pre"))
                .put("completed", finished);
        ObjectNode status = objectMapper.createObjectNode();
        status.set("type", statusType);
        String scoreLine = scoreLine(match, finished ? name : null);
        if (scoreLine != null) status.put("displayClock", scoreLine);

        ArrayNode competitors = objectMapper.createArrayNode();
        for (JsonNode competitor : match.path("competitors")) {
            ObjectNode adapted = objectMapper.createObjectNode()
                    .put("homeAway", competitor.path("homeAway").asText(competitor.path("order").asInt() == 1 ? "home" : "away"))
                    .put("winner", finished && competitor.path("winner").asBoolean(false));
            ObjectNode player = player(competitor);
            if (player != null) adapted.set("team", player);
            if (complete || live) adapted.put("score", String.valueOf(setsWon(competitor)));
            competitors.add(adapted);
        }

        String id = ID_PREFIX + match.path("id").asText();
        ObjectNode competition = objectMapper.createObjectNode().put("id", id).put("altGameNote", "");
        competition.set("status", status);
        competition.set("competitors", competitors);
        ObjectNode event = objectMapper.createObjectNode()
                .put("id", id)
                .put("date", match.path("date").asText(match.path("startDate").asText("")));
        event.putArray("competitions").add(competition);
        event.putObject("season").put("slug", roundSlug);
        return event;
    }

    /**
     * Juegos de cada set, del primer jugador y del segundo, con los puntos del tie-break del que lo pierde
     * («6-4 3-6 7-6(5)»), y cómo acabó si no fue un partido completo: {@code RET} (retirada), {@code WO}
     * (W.O.), {@code DEF} (descalificación) o {@code ABD} (suspendido). Se guarda en {@code display_clock}:
     * en directo da el marcador del set en juego y, terminado, el resultado completo. Null sin nada que contar.
     *
     * @param finishedStatus estado de ESPN si el partido ha terminado; null si no
     */
    static String scoreLine(JsonNode match, String finishedStatus) {
        JsonNode home = null;
        JsonNode away = null;
        for (JsonNode competitor : match.path("competitors")) {
            String side = competitor.path("homeAway").asText(competitor.path("order").asInt() == 1 ? "home" : "away");
            if ("home".equals(side)) home = competitor;
            else away = competitor;
        }
        StringBuilder line = new StringBuilder();
        if (home != null && away != null) {
            JsonNode homeSets = home.path("linescores");
            JsonNode awaySets = away.path("linescores");
            for (int i = 0; i < Math.min(homeSets.size(), awaySets.size()); i++) {
                JsonNode h = homeSets.get(i);
                JsonNode a = awaySets.get(i);
                if (!h.path("value").isNumber() || !a.path("value").isNumber()) break;
                if (!line.isEmpty()) line.append(' ');
                line.append(h.path("value").asInt()).append('-').append(a.path("value").asInt());
                if (h.path("tiebreak").isNumber() && a.path("tiebreak").isNumber()) {
                    line.append('(').append(Math.min(h.path("tiebreak").asInt(), a.path("tiebreak").asInt())).append(')');
                }
            }
        }
        String ending = finishedStatus == null ? null : switch (finishedStatus) {
            case "STATUS_RETIRED" -> "RET";
            case "STATUS_WALKOVER" -> "WO";
            case "STATUS_DEFAULT", "STATUS_DEFAULTED" -> "DEF";
            case "STATUS_ABANDONED" -> "ABD";
            default -> null;
        };
        if (ending != null) {
            if (!line.isEmpty()) line.append(' ');
            line.append(ending);
        }
        return line.isEmpty() ? null : line.toString();
    }

    private static int setsWon(JsonNode competitor) {
        int won = 0;
        for (JsonNode set : competitor.path("linescores")) {
            if (set.path("winner").asBoolean(false)) won++;
        }
        return won;
    }

    /** Jugador como equipo, con la bandera de su país como escudo; null si aún está por decidir. */
    private ObjectNode player(JsonNode competitor) {
        JsonNode athlete = competitor.path("athlete");
        String id = competitor.path("id").asText("");
        String name = athlete.path("displayName").asText("").trim();
        if (!"athlete".equals(competitor.path("type").asText("athlete")) || !id.matches("[0-9]{1,12}")
                || name.isEmpty() || "TBD".equalsIgnoreCase(name)) {
            return null;
        }
        ObjectNode player = objectMapper.createObjectNode()
                .put("id", ID_PREFIX + id)
                .put("displayName", name)
                .put("abbreviation", name);
        String flag = athlete.path("flag").path("href").asText(null);
        if (flag != null && flag.startsWith("https://")) player.put("logo", flag);
        return player;
    }

    private static TennisTournaments.Ref ref(String externalId) {
        return TennisTournaments.parse(externalId)
                .orElseThrow(() -> new IllegalArgumentException("Torneo de tenis desconocido: " + externalId));
    }

    private static Instant instant(String iso) {
        if (iso == null) return null;
        try {
            return ZonedDateTime.parse(iso).toInstant();
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    /** Respuesta JSON, o null si ESPN no tiene el recurso (4xx). Un 5xx o un fallo de red es una excepción. */
    private JsonNode get(String url) throws Exception {
        CircuitBreaker breaker = circuitBreakerRegistry.circuitBreaker(CIRCUIT_BREAKER);
        try {
            return breaker.executeCallable(() -> request(url));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw e;
        }
    }

    private JsonNode request(String url) throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofSeconds(20))
                .header("Accept", "application/json")
                .header("Accept-Encoding", "identity")
                .GET()
                .build();
        HttpResponse<byte[]> response = httpClient.send(request, HttpResponse.BodyHandlers.ofByteArray());
        int status = response.statusCode();
        if (status >= 500 || status == 429) throw new IOException("ESPN tenis devolvió HTTP " + status);
        if (status < 200 || status >= 300) {
            log.debug("ESPN tenis devolvió HTTP {}: {}", status, url);
            return null;
        }
        byte[] body = response.body();
        if (body == null || body.length == 0) throw new IOException("ESPN tenis devolvió una respuesta vacía");
        String json = new String(body, StandardCharsets.UTF_8);
        if (!json.trim().startsWith("{")) throw new IOException("ESPN tenis no devolvió JSON");
        return objectMapper.readTree(json);
    }
}
