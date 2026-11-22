package app.porrapp.service.demo;

import app.porrapp.config.DemoCrawl;
import app.porrapp.config.JwtUtil;
import app.porrapp.repository.UserAccountRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Function;

/**
 * Datos de la demo pública (/demo) sacados en vivo de las ligas reales: el servidor se pide a sí
 * mismo, como la participante de la demo, las mismas respuestas que pediría la aplicación, las
 * anonimiza ({@link DemoAnonymizer}) y las guarda {@link #MAX_AGE}. Pasado ese tiempo sigue
 * sirviendo la copia anterior mientras prepara otra, así que nadie espera a que se recorra todo.
 * <p>
 * El resultado tiene la forma de {@code frontend/public/demo-data.json}, que queda de respaldo.
 * </p>
 */
@Service
@Slf4j
public class DemoSnapshotService {

    static final Duration MAX_AGE = Duration.ofMinutes(10);
    /** Partidos cerrados por liga de los que se guarda quién puso qué: los más recientes. */
    private static final int MAX_MATCHES = 150;
    private static final int CHUNK = 40;
    private static final List<String> TOURNAMENT_PARTS =
            List.of("format", "group-odds", "official-bracket", "scorers", "standings");

    private final JwtUtil jwtUtil;
    private final UserAccountRepository users;
    private final ObjectMapper mapper;
    private final Environment environment;
    private final Clock clock;
    private final long demoUserId;
    private final Map<Long, String> leagues;
    private final boolean warmUp;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    /** Pocas peticiones a la vez: el recorrido no debe quitarle sitio a los usuarios de verdad. */
    private final ExecutorService crawler = Executors.newFixedThreadPool(4, Thread.ofPlatform()
            .name("demo-crawl-", 0).daemon(true).factory());
    private final AtomicBoolean refreshing = new AtomicBoolean();

    private volatile Snapshot current;

    record Snapshot(byte[] json, Instant builtAt) {
    }

    @Autowired
    public DemoSnapshotService(JwtUtil jwtUtil, UserAccountRepository users, ObjectMapper mapper,
                               Environment environment,
                               @Value("${app.demo.user-id:7}") long demoUserId,
                               @Value("${app.demo.warm-up:true}") boolean warmUp) {
        this(jwtUtil, users, mapper, environment, Clock.systemUTC(), demoUserId, warmUp);
    }

    DemoSnapshotService(JwtUtil jwtUtil, UserAccountRepository users, ObjectMapper mapper,
                        Environment environment, Clock clock, long demoUserId, boolean warmUp) {
        this.jwtUtil = jwtUtil;
        this.users = users;
        this.mapper = mapper;
        this.environment = environment;
        this.clock = clock;
        this.demoUserId = demoUserId;
        this.warmUp = warmUp;
        // Primero LaLiga, que es la que abre la demo.
        this.leagues = new LinkedHashMap<>();
        leagues.put(6L, "LaLiga de la oficina");
        leagues.put(1L, "Porra del Mundial 2026");
        leagues.put(39L, "Porra UFC");
    }

    /** Prepara los datos al arrancar, para que el primero que abra la demo ya los tenga. */
    @EventListener(ApplicationReadyEvent.class)
    public void warmUp() {
        if (warmUp) refreshInBackground();
    }

    /** JSON de la demo, o vacío si aún no se ha podido preparar ninguno. */
    public Optional<byte[]> snapshot() {
        Snapshot snapshot = current;
        if (snapshot == null || snapshot.builtAt().plus(MAX_AGE).isBefore(clock.instant())) {
            refreshInBackground();
        }
        return Optional.ofNullable(snapshot).map(Snapshot::json);
    }

    private void refreshInBackground() {
        if (!refreshing.compareAndSet(false, true)) return;
        Thread.ofVirtual().name("demo-snapshot").start(() -> {
            try {
                current = new Snapshot(build(), clock.instant());
            } catch (Exception e) {
                log.warn("No se han podido preparar los datos de la demo: {}", e.toString());
            } finally {
                refreshing.set(false);
            }
        });
    }

    byte[] build() {
        String email = users.findById(demoUserId)
                .orElseThrow(() -> new IllegalStateException("No existe el usuario de la demo " + demoUserId))
                .getGoogleEmail();
        Crawl crawl = new Crawl(jwtUtil.generateAccessToken(demoUserId, email));
        Set<Long> leagueIds = leagues.keySet();

        crawl.all(List.of("/users/me", "/groups/mine", "/groups/mine/summary", "/predictions/mine", "/competitions"));

        Set<Long> competitions = new LinkedHashSet<>();
        Map<Long, List<JsonNode>> closedMatches = new LinkedHashMap<>();
        Map<Long, List<Long>> allMatches = new LinkedHashMap<>();
        for (Long g : leagueIds) {
            String q = "?groupId=" + g;
            crawl.all(List.of("/groups/" + g, "/groups/" + g + "/members", "/groups/" + g + "/scoring",
                    "/groups/" + g + "/scorer-picks", "/groups/" + g + "/scorer-pick",
                    "/groups/" + g + "/competition/lock-state", "/leaderboard" + q, "/leaderboard/matchdays" + q,
                    "/leaderboard/logs" + q, "/predictions" + q, "/predictions/matchday/stats" + q,
                    "/predictions/matchday/survivor" + q, "/predictions/matchday" + q + "&round=current"));
            JsonNode league = crawl.exact.get("/groups/" + g);
            if (league != null && league.path("competitionId").isIntegralNumber()) {
                competitions.add(league.path("competitionId").asLong());
            }

            List<String> rounds = new ArrayList<>();
            crawl.exact.getOrDefault("/leaderboard/matchdays" + q, mapper.createArrayNode())
                    .forEach(day -> rounds.add("/predictions/matchday" + q + "&round=" + encode(day.path("label").asString())));
            crawl.all(rounds);

            Map<Long, JsonNode> fixtures = new LinkedHashMap<>();
            rounds.add("/predictions/matchday" + q + "&round=current");
            rounds.forEach(key -> crawl.exact.getOrDefault(key, mapper.createArrayNode())
                    .forEach(f -> fixtures.putIfAbsent(f.path("matchId").asLong(), f)));
            allMatches.put(g, recent(fixtures.values(), f -> true));
            closedMatches.put(g, fixtures.values().stream()
                    .filter(f -> f.path("locked").asBoolean() || f.path("finished").asBoolean())
                    .sorted(Comparator.comparing((JsonNode f) -> f.path("matchDate").asString()).reversed())
                    .limit(MAX_MATCHES).toList());

            List<String> entries = new ArrayList<>();
            crawl.exact.getOrDefault("/leaderboard" + q, mapper.createArrayNode()).forEach(row -> {
                if (row.path("id").isIntegralNumber()) {
                    entries.add("/predictions/" + row.path("id").asLong());
                    entries.add("/predictions/" + row.path("id").asLong() + "/score");
                }
            });
            crawl.all(entries);
        }

        List<String> perCompetition = new ArrayList<>();
        for (Long c : competitions) {
            perCompetition.add("/matches?competitionId=" + c);
            perCompetition.add("/matches/radar?competitionId=" + c);
            perCompetition.add("/competitions/" + c + "/standings");
            TOURNAMENT_PARTS.forEach(part -> perCompetition.add("/competitions/" + c + "/tournament/" + part));
        }
        crawl.all(perCompetition);

        ObjectNode voters = mapper.createObjectNode();
        ObjectNode participants = mapper.createObjectNode();
        for (Long g : leagueIds) {
            List<Long> closed = closedMatches.get(g).stream().map(f -> f.path("matchId").asLong()).toList();
            crawl.all(closed.stream()
                    .map(id -> "/predictions/matchday/matches/" + id + "/predictions?groupId=" + g).toList());

            ObjectNode byMatch = voters.putObject(String.valueOf(g));
            for (int i = 0; i < closed.size(); i += CHUNK) {
                List<Long> chunk = closed.subList(i, Math.min(closed.size(), i + CHUNK));
                crawl.fetch("/predictions/matchday/stats/voters?groupId=" + g + "&matchIds=" + join(chunk))
                        .ifPresent(list -> list.forEach(v -> byMatch.set(v.path("matchId").asString(), v)));
            }
            ObjectNode whoPlayed = participants.putObject(String.valueOf(g));
            List<Long> ids = allMatches.get(g);
            List<CompletableFuture<Void>> pending = ids.stream().map(id -> CompletableFuture.runAsync(() ->
                    crawl.fetch("/predictions/matchday/stats/participants?groupId=" + g + "&matchIds=" + id)
                            .ifPresent(list -> {
                                synchronized (whoPlayed) {
                                    whoPlayed.set(String.valueOf(id), list);
                                }
                            }), crawler)).toList();
            CompletableFuture.allOf(pending.toArray(CompletableFuture[]::new)).join();
        }

        keepDemoLeagues(crawl.exact, leagueIds);
        List<JsonNode> nodes = new ArrayList<>(crawl.exact.values());
        nodes.add(voters);
        nodes.add(participants);
        new DemoAnonymizer(leagues).anonymize(nodes);

        ObjectNode exact = mapper.createObjectNode();
        crawl.exact.forEach(exact::set);
        ObjectNode result = mapper.createObjectNode();
        result.put("recordedAt", clock.instant().toString());
        result.set("exact", exact);
        result.set("voters", voters);
        result.set("participants", participants);
        log.info("Datos de la demo preparados: {} respuestas", exact.size());
        return mapper.writeValueAsBytes(result);
    }

    /** Las listas de la usuaria de la demo se quedan solo con las ligas de la demo. */
    private void keepDemoLeagues(Map<String, JsonNode> exact, Set<Long> leagueIds) {
        filter(exact.get("/groups/mine"), item -> leagueIds.contains(item.path("id").asLong()));
        filter(exact.get("/groups/mine/summary"), item -> leagueIds.contains(item.path("groupId").asLong()));
        filter(exact.get("/predictions/mine"), item -> leagueIds.contains(item.path("groupId").asLong()));
        if (exact.get("/users/me") instanceof ObjectNode me) {
            ObjectNode clean = mapper.createObjectNode();
            clean.put("userId", demoUserId);
            clean.set("participantName", me.path("participantName"));
            clean.put("lastSelectedGroupId", leagueIds.iterator().next());
            clean.putNull("avatarUrl");
            clean.put("profileSetupCompleted", true);
            clean.put("admin", false);
            exact.put("/users/me", clean);
        }
    }

    private static void filter(JsonNode list, Function<JsonNode, Boolean> keep) {
        if (!(list instanceof ArrayNode array)) return;
        for (int i = array.size() - 1; i >= 0; i--) {
            if (!keep.apply(array.get(i))) array.remove(i);
        }
    }

    private static List<Long> recent(java.util.Collection<JsonNode> fixtures, Function<JsonNode, Boolean> keep) {
        return fixtures.stream().filter(keep::apply)
                .sorted(Comparator.comparing((JsonNode f) -> f.path("matchDate").asString()).reversed())
                .limit(MAX_MATCHES).map(f -> f.path("matchId").asLong()).toList();
    }

    private static String join(List<Long> ids) {
        return String.join(",", ids.stream().map(String::valueOf).toList());
    }

    /** Como encodeURIComponent, que es como la aplicación pone la jornada en la URL. */
    static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8)
                .replace("+", "%20").replace("%21", "!").replace("%27", "'")
                .replace("%28", "(").replace("%29", ")").replace("%7E", "~");
    }

    /** Un recorrido: las respuestas, por la misma ruta con la que las pide la aplicación. */
    private final class Crawl {
        final Map<String, JsonNode> exact = new java.util.concurrent.ConcurrentHashMap<>();
        private final String token;
        private final String base = "http://127.0.0.1:"
                + environment.getProperty("local.server.port", environment.getProperty("server.port", "8080"))
                + "/api";

        Crawl(String token) {
            this.token = token;
        }

        void all(List<String> paths) {
            CompletableFuture.allOf(paths.stream()
                    .map(path -> CompletableFuture.runAsync(() -> fetch(path).ifPresent(body -> exact.put(path, body)), crawler))
                    .toArray(CompletableFuture[]::new)).join();
        }

        Optional<JsonNode> fetch(String path) {
            try {
                HttpRequest request = HttpRequest.newBuilder(URI.create(base + path))
                        .timeout(Duration.ofSeconds(20))
                        .header("Authorization", "Bearer " + token)
                        .header(DemoCrawl.HEADER, DemoCrawl.key())
                        .header("Accept", "application/json")
                        .GET().build();
                HttpResponse<byte[]> response = http.send(request, HttpResponse.BodyHandlers.ofByteArray());
                if (response.statusCode() != 200 || response.body().length == 0) return Optional.empty();
                return Optional.of(mapper.readTree(response.body()));
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return Optional.empty();
            } catch (Exception e) {
                log.debug("Demo: sin respuesta para {}: {}", path, e.toString());
                return Optional.empty();
            }
        }
    }
}
