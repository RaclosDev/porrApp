package app.porrapp.service.tournament;

import app.porrapp.model.Competition;
import app.porrapp.model.TournamentFormat;
import app.porrapp.model.Sport;
import app.porrapp.repository.CompetitionRepository;
import app.porrapp.repository.EditionRepository;
import app.porrapp.repository.MatchRepository;
import app.porrapp.service.prediction.ScoreInvalidationService;
import app.porrapp.service.notification.WebSocketService;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import app.porrapp.sports.SportsDataProvider;
import app.porrapp.dto.TopScorerDTO;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.scheduling.annotation.Scheduled;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.stereotype.Service;

import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.URI;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;
import java.util.Comparator;

/**
 * Goleadores de cada competición de fútbol. Los de un torneo con grupos salen de sus partidos en ESPN; los
 * del resto (ligas, copas), de la tabla de goleadores de ESPN, y solo se piden si alguna liga juega el
 * pichichi. Se refrescan cada 30 min y al terminar un partido. La lista se guarda en la base de datos
 * ({@link TopScorerStore}), por temporada: al arrancar se lee de ahí y, con la competición ya cerrada, no se
 * vuelve a pedir al proveedor.
 */
@Service
@Slf4j
public class TopScorerService {

    private final ObjectMapper objectMapper;
    private final WebSocketService webSocketService;
    private final HttpClient httpClient;
    private final SportsDataProvider sportsDataProvider;
    private final ScoreInvalidationService scoreInvalidationService;
    private final KnockoutBracketService knockoutBracketService;
    private final TopScorerStore topScorerStore;
    private final CompetitionRepository competitionRepository;
    private final EditionRepository editionRepository;
    private final MatchRepository matchRepository;

    /** Se apaga en los tests, que no deben llamar al proveedor por su cuenta. */
    @org.springframework.beans.factory.annotation.Value("${app.pichichi.live-refresh:true}")
    private boolean liveRefreshEnabled = true;

    public TopScorerService(
            ObjectMapper objectMapper,
            WebSocketService webSocketService,
            HttpClient httpClient,
            @Qualifier("espnSportsDataProvider") SportsDataProvider sportsDataProvider,
            ScoreInvalidationService scoreInvalidationService,
            KnockoutBracketService knockoutBracketService,
            TopScorerStore topScorerStore,
            CompetitionRepository competitionRepository,
            EditionRepository editionRepository,
            MatchRepository matchRepository) {
        this.objectMapper = objectMapper;
        this.webSocketService = webSocketService;
        this.httpClient = httpClient;
        this.sportsDataProvider = sportsDataProvider;
        this.scoreInvalidationService = scoreInvalidationService;
        this.knockoutBracketService = knockoutBracketService;
        this.topScorerStore = topScorerStore;
        this.competitionRepository = competitionRepository;
        this.editionRepository = editionRepository;
        this.matchRepository = matchRepository;
    }


    /** Goleadores de una competición en memoria. */
    private static final class Scorers {
        /** Copia de la lista guardada, para no leerla en cada clasificación. */
        final AtomicReference<List<TopScorerDTO>> cached = new AtomicReference<>(Collections.emptyList());
        /** Si la lista guardada ya se ha leído tras arrancar. */
        volatile boolean storedLoaded;
    }

    /** Goleadores de cada competición, por su id: cada temporada es una fila y tiene los suyos. */
    private final Map<Long, Scorers> scorersByCompetition = new java.util.concurrent.ConcurrentHashMap<>();

    private Scorers scorersOf(Competition competition) {
        return scorersByCompetition.computeIfAbsent(competition.getId(), id -> new Scorers());
    }

    // También se cachean búsquedas vacías; las imágenes se vuelven a buscar a las seis horas.
    private record CachedImage(String url, long expiresAt) {}
    private final Map<String, CachedImage> imageCache = new LinkedHashMap<>();
    private static final long IMAGE_CACHE_TTL_MS = Duration.ofHours(6).toMillis();

    // Hardcoded cartoon URLs for known pichichi contenders (from thesportsdb)
    private static final Map<String, String> CARTOON_MAP = new HashMap<>(Map.of(
        "Kylian Mbappé", "https://r2.thesportsdb.com/images/media/player/cartoon/mya0j81771265711.png",
        "Lionel Messi", "https://r2.thesportsdb.com/images/media/player/cartoon/kzz67d1768229024.png",
        "Erling Haaland", "https://r2.thesportsdb.com/images/media/player/cartoon/z3i9s51769182480.png",
        "Vinícius Júnior", "https://r2.thesportsdb.com/images/media/player/cartoon/vq5z4u1771264896.png",
        "Vinicius Junior", "https://r2.thesportsdb.com/images/media/player/cartoon/vq5z4u1771264896.png"
    ));

    @Scheduled(initialDelay = 5_000, fixedDelay = 1_800_000)
    @SchedulerLock(name = "topScorers", lockAtMostFor = "PT10M", lockAtLeastFor = "PT1M")
    public void scheduledRefresh() {
        Map<Long, Competition> competitions = new LinkedHashMap<>();
        for (Competition tournament : competitionRepository.findByExternalIdIn(TournamentFormat.registeredExternalIds())) {
            competitions.put(tournament.getId(), tournament);
        }
        for (Competition played : editionRepository.findCompetitionsWithPichichi()) {
            competitions.putIfAbsent(played.getId(), played);
        }
        for (Competition competition : competitions.values()) {
            // Con la competición cerrada los goleadores ya no cambian: valen los guardados y no se pide nada al proveedor.
            if (!getTopScorers(competition).isEmpty() && knockoutBracketService.isOver(competition)) continue;
            refresh(competition);
        }
    }

    /** Margen tras el inicio de un partido en el que sus goles pueden seguir llegando. */
    private static final Duration RECENT_MATCH = Duration.ofHours(4);

    /**
     * Las ligas que juegan el pichichi fuera de un torneo con grupos: mientras se juega algún partido de su
     * competición, la tabla de goleadores se pide cada cinco minutos, para que al acabar el último ya sea la
     * definitiva.
     */
    @Scheduled(initialDelay = 120_000, fixedDelay = 300_000)
    @SchedulerLock(name = "topScorersLive", lockAtMostFor = "PT4M", lockAtLeastFor = "PT30S")
    public void refreshWhilePlaying() {
        if (!liveRefreshEnabled) return;
        java.time.Instant now = java.time.Instant.now();
        for (Competition competition : editionRepository.findCompetitionsWithPichichi()) {
            if (competition.isGroupTournament()) continue;
            if (matchRepository.existsByCompetitionIdAndMatchDateBetween(competition.getId(), now.minus(RECENT_MATCH), now)) {
                refresh(competition);
            }
        }
    }

    private final java.util.concurrent.locks.ReentrantLock refreshLock = new java.util.concurrent.locks.ReentrantLock();

    /** Una sola actualización simultánea; las llamadas solapadas aprovechan la que está en curso. */
    public void refresh(Competition tournament) {
        TournamentFormat format = tournament.tournamentFormat();
        if (format == null && !hasLeadersTable(tournament)) return;
        if (!refreshLock.tryLock()) return;
        try {
            List<TopScorerDTO> scorers = format != null
                    ? scorersFromMatches(tournament, format)
                    : scorersFromLeadersTable(tournament);
            if (scorers == null) return;
            List<TopScorerDTO> previous = getTopScorers(tournament);
            if (scorers.isEmpty() && !previous.isEmpty()) {
                // Los goles no se pierden: una lista vacía tras tener goleadores es que ESPN no ha respondido.
                log.warn("TopScorerService: ESPN no ha devuelto goleadores; se conservan los {} anteriores", previous.size());
                return;
            }
            scorersOf(tournament).cached.set(scorers);
            if (!scorers.equals(previous)) {
                save(tournament, scorers);
                if (format != null) {
                    // El pichichi puntúa los cuadros.
                    scoreInvalidationService.invalidateCompetition(tournament.getId());
                    webSocketService.broadcastUpdate("DATA_UPDATED");
                } else if (!leaders(scorers).equals(leaders(previous))) {
                    // En una liga solo puntúa quién va en cabeza: lo demás no cambia ningún punto.
                    scoreInvalidationService.invalidateCompetition(tournament.getId());
                    webSocketService.notifyResultsChanged(List.of(tournament.getId()));
                }
            }
            log.info("TopScorerService: Refreshed {} scorers from ESPN. Leader: {} ({} goals)",
                    scorers.size(),
                    scorers.isEmpty() ? "none" : scorers.get(0).name(),
                    scorers.isEmpty() ? 0 : scorers.get(0).goals());

        } catch (Exception e) {
            log.error("TopScorerService: Failed to fetch scorers from ESPN: {}", e.getMessage());
        } finally {
            refreshLock.unlock();
        }
    }



    /** Goleadores de un torneo con grupos, contados en sus partidos; null si el proveedor no responde. */
    private List<TopScorerDTO> scorersFromMatches(Competition tournament, TournamentFormat format) throws Exception {
        JsonNode events = sportsDataProvider.fetchScoreboardEvents(tournament.getExternalId(), format.season());
        if (events == null) return null;

        Map<String, int[]> playerGoals = new LinkedHashMap<>();
        Map<String, String> playerShortNames = new HashMap<>();
        Map<String, String> playerPositions = new HashMap<>();
        Map<String, String> playerIds = new HashMap<>();
        Map<String, String> playerTeams = new HashMap<>();

        processEvents(events, playerGoals, playerShortNames, playerPositions, playerIds, playerTeams);

        return buildScorersList(playerGoals, playerShortNames, playerPositions, playerIds, playerTeams);
    }

    /** Competición oficial de fútbol vigente de la que el proveedor publica la tabla de goleadores. */
    private boolean hasLeadersTable(Competition competition) {
        String externalId = competition.getExternalId();
        return competition.getOwnerLeague() == null && !competition.isArchived()
                && externalId != null && !externalId.isBlank()
                && Sport.ofExternalId(externalId) == Sport.FOOTBALL
                && sportsDataProvider.supports(externalId);
    }

    /**
     * Goleadores de una liga o copa según la tabla del proveedor, sin fotos; null si no la da o si ya es la
     * de otra temporada (al cambiar de temporada el proveedor pasa a dar la nueva antes de que se archive esta).
     */
    private List<TopScorerDTO> scorersFromLeadersTable(Competition competition) throws Exception {
        SportsDataProvider.ScoringLeaders table = sportsDataProvider.fetchScoringLeaders(competition.getExternalId());
        if (table == null || table.leaders() == null) return null;
        Integer season = competition.seasonStartYear();
        if (season != null && table.seasonYear() != null && !season.equals(table.seasonYear())) return null;

        List<TopScorerDTO> scorers = new ArrayList<>();
        for (JsonNode leader : table.leaders()) {
            JsonNode athlete = leader.path("athlete");
            String name = athlete.path("displayName").asText("").trim();
            int goals = (int) Math.round(leader.path("value").asDouble(0));
            if (name.isEmpty() || goals <= 0) continue;
            scorers.add(new TopScorerDTO(
                    name,
                    athlete.path("shortName").asText(name).trim(),
                    goals,
                    athlete.path("position").path("abbreviation").asText(""),
                    athlete.path("id").asText(""),
                    athlete.path("team").path("displayName").asText(""),
                    ""));
        }
        scorers.sort(Comparator.comparingInt(TopScorerDTO::goals).reversed());
        return scorers;
    }

    /** Quiénes van en cabeza: los que tienen el máximo de goles. */
    private static Set<String> leaders(List<TopScorerDTO> scorers) {
        if (scorers.isEmpty()) return Set.of();
        int max = scorers.get(0).goals();
        Set<String> names = new TreeSet<>();
        for (TopScorerDTO scorer : scorers) {
            if (scorer.goals() == max) names.add(scorer.playerId() + "|" + scorer.name());
        }
        return names;
    }

    private void processEvents(JsonNode events, Map<String, int[]> playerGoals, Map<String, String> playerShortNames,
                               Map<String, String> playerPositions, Map<String, String> playerIds,
                               Map<String, String> playerTeams) {
        for (JsonNode event : events) {
            JsonNode competitionNode = event.path("competitions").get(0);
            if (competitionNode == null) continue;

            Map<String, String> teamNames = buildTeamNamesMap(competitionNode);
            JsonNode details = competitionNode.path("details");
            if (!details.isArray()) continue;

            for (JsonNode detail : details) {
                processDetail(detail, teamNames, playerGoals, playerShortNames, playerPositions, playerIds, playerTeams);
            }
        }
    }

    private Map<String, String> buildTeamNamesMap(JsonNode competitionNode) {
        Map<String, String> teamNames = new HashMap<>();
        JsonNode competitors = competitionNode.path("competitors");
        if (competitors.isArray()) {
            for (JsonNode comp : competitors) {
                String tid = comp.path("id").asText("");
                String tname = comp.path("team").path("displayName").asText("");
                if (!tid.isEmpty() && !tname.isEmpty()) teamNames.put(tid, tname);
            }
        }
        return teamNames;
    }

    private void processDetail(JsonNode detail, Map<String, String> teamNames,
                               Map<String, int[]> playerGoals, Map<String, String> playerShortNames,
                               Map<String, String> playerPositions, Map<String, String> playerIds,
                               Map<String, String> playerTeams) {
        if (!detail.path("scoringPlay").asBoolean(false)) return;
        if (detail.path("ownGoal").asBoolean(false)) return;

        JsonNode athletes = detail.path("athletesInvolved");
        if (!athletes.isArray() || athletes.isEmpty()) return;

        JsonNode scorer = athletes.get(0);
        String fullName = scorer.path("displayName").asText("").trim();
        if (fullName.isEmpty()) return;

        String shortName = getShortName(scorer, fullName);
        String position = scorer.path("position").asText("");
        String playerId = scorer.path("id").asText("");
        String teamName = getTeamName(scorer, detail, teamNames);

        playerGoals.computeIfAbsent(fullName, k -> new int[1])[0]++;
        playerShortNames.put(fullName, shortName);
        playerPositions.put(fullName, position);
        playerIds.put(fullName, playerId);
        playerTeams.put(fullName, teamName);
    }

    private String getShortName(JsonNode scorer, String fullName) {
        String shortName = scorer.path("shortName").asText(fullName).trim();
        if (shortName.equals(fullName) || (!shortName.contains(".") && shortName.split(" ").length > 1)) {
            String[] parts = fullName.split(" ");
            if (parts.length > 1) {
                shortName = parts[0].substring(0, 1).toUpperCase() + ". " + parts[parts.length - 1];
            }
        }
        return shortName;
    }

    private String getTeamName(JsonNode scorer, JsonNode detail, Map<String, String> teamNames) {
        String teamName = scorer.path("team").path("displayName").asText("");
        if (teamName.isEmpty()) {
            String teamId = scorer.path("teamId").asText("");
            if (teamId.isEmpty()) {
                teamId = detail.path("team").path("id").asText("");
            }
            if (!teamId.isEmpty()) {
                teamName = teamNames.getOrDefault(teamId, "");
            }
        }
        return teamName;
    }

    private String fetchImageUrl(String fullName) {
        String imageUrl = CARTOON_MAP.get(fullName);
        if (imageUrl != null) return imageUrl;
        
        long now = System.currentTimeMillis();
        CachedImage cached = imageCache.get(fullName);
        if (cached != null && cached.expiresAt() > now) return cached.url();
        String resolved = lookupImageUrl(fullName);
        if (imageCache.size() >= 1000) imageCache.remove(imageCache.keySet().iterator().next());
        imageCache.put(fullName, new CachedImage(resolved, now + IMAGE_CACHE_TTL_MS));
        return resolved;
    }

    private String lookupImageUrl(String fullName) {
        String imageUrl = "";
        try {
            String encodedName = java.net.URLEncoder.encode(fullName, "UTF-8").replace("+", "%20");
            
            // First try TheSportsDB
            String sportsDbUrl = "https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=" + encodedName;
            HttpRequest sportsReq = HttpRequest.newBuilder()
                    .uri(URI.create(sportsDbUrl))
                    .timeout(Duration.ofSeconds(5))
                    .header("User-Agent", "PorrApp/1.0")
                    .GET()
                    .build();
            HttpResponse<String> sportsRes = httpClient.send(sportsReq, HttpResponse.BodyHandlers.ofString());
            if (sportsRes.statusCode() == 200) {
                JsonNode sportsRoot = objectMapper.readTree(sportsRes.body());
                JsonNode players = sportsRoot.path("player");
                if (players.isArray() && !players.isEmpty()) {
                    JsonNode p = players.get(0);
                    imageUrl = p.path("strRender").asText("");
                    if (imageUrl.isEmpty()) imageUrl = p.path("strCutout").asText("");
                    if (imageUrl.isEmpty()) imageUrl = p.path("strThumb").asText("");
                }
            }

            // Fallback to Wikipedia
            if (imageUrl.isEmpty()) {
                String wikiUrl = "https://en.wikipedia.org/api/rest_v1/page/summary/" + encodedName;
                HttpRequest wikiReq = HttpRequest.newBuilder()
                        .uri(URI.create(wikiUrl))
                        .timeout(Duration.ofSeconds(5))
                        .header("User-Agent", "PorrApp/1.0")
                        .GET()
                        .build();
                HttpResponse<String> wikiRes = httpClient.send(wikiReq, HttpResponse.BodyHandlers.ofString());
                if (wikiRes.statusCode() == 200) {
                    JsonNode wikiRoot = objectMapper.readTree(wikiRes.body());
                    imageUrl = wikiRoot.path("thumbnail").path("source").asText("");
                }
            }
        } catch (Exception e) {
            if (e instanceof InterruptedException) Thread.currentThread().interrupt();
            log.warn("TopScorerService: image lookup failed for {}: {}", fullName, e.getMessage());
        }
        return imageUrl != null ? imageUrl : "";
    }

    private List<TopScorerDTO> buildScorersList(Map<String, int[]> playerGoals, Map<String, String> playerShortNames,
                                                       Map<String, String> playerPositions, Map<String, String> playerIds,
                                                       Map<String, String> playerTeams) {
        List<TopScorerDTO> scorers = new ArrayList<>();
        for (Map.Entry<String, int[]> entry : playerGoals.entrySet()) {
            if (Thread.currentThread().isInterrupted()) throw new java.util.concurrent.CancellationException("Refresco interrumpido");
            String name = entry.getKey();
            scorers.add(new TopScorerDTO(
                    name,
                    playerShortNames.getOrDefault(name, name),
                    entry.getValue()[0],
                    playerPositions.getOrDefault(name, ""),
                    playerIds.getOrDefault(name, ""),
                    playerTeams.getOrDefault(name, ""),
                    fetchImageUrl(name)));
        }
        scorers.sort(Comparator.comparingInt(TopScorerDTO::goals).reversed());
        return scorers;
    }

    /**
     * Goleadores actuales de una competición. La primera vez tras arrancar se leen de la base de datos, sin avisar a
     * nadie ni recalcular puntos: son los mismos con los que ya se puntuó.
     */
    public List<TopScorerDTO> getTopScorers(Competition tournament) {
        Scorers scorers = scorersOf(tournament);
        List<TopScorerDTO> cached = scorers.cached.get();
        if (!cached.isEmpty() || scorers.storedLoaded) return cached;
        try {
            List<TopScorerDTO> stored = topScorerStore.load(tournament.getId());
            scorers.storedLoaded = true;
            if (!stored.isEmpty()) scorers.cached.compareAndSet(cached, stored);
        } catch (Exception e) {
            // Se reintenta en la siguiente consulta.
            log.warn("TopScorerService: no se pudieron leer los goleadores guardados: {}", e.getMessage());
        }
        return scorers.cached.get();
    }

    /** Si falla el guardado, la lista sigue en memoria y se vuelve a guardar en el siguiente cambio o arranque. */
    private void save(Competition tournament, List<TopScorerDTO> scorers) {
        try {
            topScorerStore.replace(tournament.getId(), scorers);
        } catch (Exception e) {
            log.warn("TopScorerService: no se pudieron guardar los goleadores: {}", e.getMessage());
        }
    }
}
