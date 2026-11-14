package app.porrapp.service.league;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Component;
import org.springframework.web.util.HtmlUtils;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Búsqueda de canciones en la API oficial de YouTube (Data API v3, clave en {@code YOUTUBE_API_KEY}).
 * Sin clave queda desactivada; con {@code YOUTUBE_DEMO=true} devuelve unos resultados fijos para probar en local.
 */
@Component
@Slf4j
public class YoutubeSearchClient {

    public record Track(String videoId, String title, String channel) {}

    private static final String ENDPOINT = "https://www.googleapis.com/youtube/v3/search";
    private static final Duration TIMEOUT = Duration.ofSeconds(8);
    private static final List<Track> DEMO = List.of(
            new Track("fJ9rUzIMcZQ", "Queen – Bohemian Rhapsody", "Queen Official"),
            new Track("dQw4w9WgXcQ", "Rick Astley – Never Gonna Give You Up", "Rick Astley"),
            new Track("kJQP7kiw5Fk", "Luis Fonsi – Despacito ft. Daddy Yankee", "LuisFonsiVEVO"),
            new Track("OPf0YbXqDm0", "Mark Ronson – Uptown Funk ft. Bruno Mars", "Mark Ronson"),
            new Track("JGwWNGJdvx8", "Ed Sheeran – Shape of You", "Ed Sheeran"),
            new Track("9bZkp7q19f0", "PSY – Gangnam Style", "officialpsy"),
            new Track("hT_nvWreIhg", "OneRepublic – Counting Stars", "OneRepublic"),
            new Track("RgKAFK5djSk", "Wiz Khalifa – See You Again ft. Charlie Puth", "Wiz Khalifa"));

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final String apiKey;
    private final boolean demo;

    public YoutubeSearchClient(HttpClient httpClient, ObjectMapper objectMapper,
                               @Value("${app.youtube.api-key:}") String apiKey,
                               @Value("${app.youtube.demo:false}") boolean demo) {
        this.httpClient = httpClient;
        this.objectMapper = objectMapper;
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.demo = demo;
    }

    public boolean isEnabled() {
        return demo || !apiKey.isEmpty();
    }

    /** Hasta seis vídeos incrustables para la consulta; vacío si falla la API. Las consultas repetidas se cachean. */
    @Cacheable(value = "youtubeSearch", key = "#query", sync = true)
    public List<Track> search(String query) {
        if (demo && apiKey.isEmpty()) return demoResults(query);
        String url = ENDPOINT + "?part=snippet&type=video&maxResults=6&videoEmbeddable=true&videoSyndicated=true"
                + "&safeSearch=moderate&q=" + URLEncoder.encode(query, StandardCharsets.UTF_8) + "&key="
                + URLEncoder.encode(apiKey, StandardCharsets.UTF_8);
        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(url)).timeout(TIMEOUT)
                    .header("Accept", "application/json").GET().build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                log.warn("YouTube respondió {} a la búsqueda de música", response.statusCode());
                return List.of();
            }
            return parse(objectMapper.readTree(response.body()));
        } catch (IOException failure) {
            log.warn("No se pudo buscar en YouTube: {}", failure.getMessage());
            return List.of();
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            return List.of();
        }
    }

    static List<Track> parse(JsonNode root) {
        List<Track> tracks = new ArrayList<>();
        for (JsonNode item : root.path("items")) {
            String id = item.path("id").path("videoId").asText("");
            JsonNode snippet = item.path("snippet");
            String title = HtmlUtils.htmlUnescape(snippet.path("title").asText(""));
            if (!PokerMusicService.VIDEO_ID.matcher(id).matches() || title.isBlank()) continue;
            String channel = HtmlUtils.htmlUnescape(snippet.path("channelTitle").asText(""));
            tracks.add(new Track(id, cut(title, 150), cut(channel, 100)));
        }
        return tracks;
    }

    private static List<Track> demoResults(String query) {
        String needle = query.toLowerCase(Locale.ROOT);
        List<Track> matching = DEMO.stream()
                .filter(track -> track.title().toLowerCase(Locale.ROOT).contains(needle)
                        || track.channel().toLowerCase(Locale.ROOT).contains(needle)).toList();
        return matching.isEmpty() ? DEMO.subList(0, 6) : matching;
    }

    private static String cut(String text, int max) {
        String clean = text.strip();
        return clean.length() <= max ? clean : clean.substring(0, max);
    }
}
