package app.porrapp.controller;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.util.Set;

/**
 * Sirve las páginas de la SPA. Cada ruta conocida recibe su HTML prerenderizado en la build
 * del frontend ({@code static/<ruta>/index.html}) o, si no lo tiene, el {@code index.html}
 * común. Las pantallas de la app llevan {@code X-Robots-Tag: noindex}: solo las páginas
 * públicas de {@link #INDEXABLE} deben aparecer en los buscadores. Una ruta desconocida no
 * llega aquí y termina en un 404 real ({@link #notFound}), no en un 200 con la portada.
 *
 * <p>Las listas deben coincidir con {@code frontend/src/seo/pages.ts}; un test del frontend
 * las compara.
 */
@RestController
public class SpaPageController {

    /** Páginas públicas con contenido propio, las únicas que se pueden indexar. */
    public static final Set<String> INDEXABLE = Set.of(
            "/", "/como-funciona", "/porra-laliga", "/porra-champions", "/porra-premier-league",
            "/porra-mundial", "/porra-f1", "/porra-ufc", "/porra-nba", "/porra-nfl", "/porra-tenis",
            "/plantilla-porra-excel", "/alternativa-laporra", "/mejores-apps-porra",
            "/porra-oficina", "/porra-vs-quiniela", "/porra-copa-del-rey",
            "/apuntar-puntos-juegos-de-mesa", "/timbas-de-poker",
            "/porra-entre-amigos", "/como-hacer-una-porra", "/instalar-app-movil",
            "/privacidad", "/aviso-legal");

    /** Pantallas de la app: existen, pero no tienen sentido en un buscador. */
    public static final Set<String> APP = Set.of(
            "/demo", "/linkedin", "/radar", "/ranking", "/clasificacion", "/grupos", "/stats", "/search",
            "/mis-ligas", "/crear-liga", "/marcador/nuevo", "/poker/nueva", "/bracket", "/tabla", "/prediction", "/jornadas",
            "/partida", "/historico", "/torneos/nuevo",
            "/poker/mesa", "/poker/historico", "/poker/estadisticas",
            "/restablecer-contrasena", "/gestion-7k2q");

    private static final String NOINDEX = "noindex";
    private static final MediaType MANIFEST = MediaType.valueOf("application/manifest+json");
    private static final MediaType HTML_UTF8 = new MediaType(MediaType.TEXT_HTML, StandardCharsets.UTF_8);

    @GetMapping({
            "/", "/como-funciona", "/porra-laliga", "/porra-champions", "/porra-premier-league",
            "/porra-mundial", "/porra-f1", "/porra-ufc", "/porra-nba", "/porra-nfl", "/porra-tenis",
            "/plantilla-porra-excel", "/alternativa-laporra", "/mejores-apps-porra",
            "/porra-oficina", "/porra-vs-quiniela", "/porra-copa-del-rey", "/apuntar-puntos-juegos-de-mesa", "/timbas-de-poker",
            "/porra-entre-amigos", "/como-hacer-una-porra", "/instalar-app-movil",
            "/privacidad", "/aviso-legal",
            "/demo", "/linkedin", "/radar", "/ranking", "/clasificacion", "/grupos", "/stats", "/search",
            "/mis-ligas", "/crear-liga", "/marcador/nuevo", "/poker/nueva", "/bracket", "/tabla", "/prediction", "/jornadas",
            "/partida", "/historico", "/torneos/nuevo", "/torneos/{id:[0-9]+}", "/t/{publicId}",
            "/poker/mesa", "/poker/historico", "/poker/estadisticas",
            "/restablecer-contrasena", "/gestion-7k2q"})
    public ResponseEntity<Resource> page(HttpServletRequest request) {
        String path = request.getRequestURI();
        ResponseEntity.BodyBuilder response = html(HttpStatus.OK);
        if (!INDEXABLE.contains(path)) {
            response.header("X-Robots-Tag", NOINDEX);
        }
        return response.body(pageHtml(path));
    }

    /** El manifiesto de la PWA con su tipo propio: como archivo estático salía como application/octet-stream. */
    @GetMapping("/manifest.webmanifest")
    public ResponseEntity<Resource> manifest() {
        Resource manifest = new ClassPathResource("static/manifest.webmanifest");
        if (!manifest.exists()) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok()
                .contentType(MANIFEST)
                .cacheControl(CacheControl.noCache())
                .body(manifest);
    }

    /**
     * Respuesta para una dirección sin página ni archivo. Con barra final de una página
     * conocida redirige a la dirección sin barra; si no, 404 con el HTML de la app para que
     * quien llegue por un enlace roto vea la portada.
     */
    static ResponseEntity<Resource> notFound(HttpServletRequest request) {
        String path = request.getRequestURI();
        String trimmed = path.replaceAll("/+$", "");
        if (!trimmed.isEmpty() && !trimmed.equals(path) && (INDEXABLE.contains(trimmed) || APP.contains(trimmed))) {
            String query = request.getQueryString();
            return ResponseEntity.status(HttpStatus.MOVED_PERMANENTLY)
                    .header(HttpHeaders.LOCATION, query == null ? trimmed : trimmed + "?" + query)
                    .build();
        }
        return html(HttpStatus.NOT_FOUND).header("X-Robots-Tag", NOINDEX).body(pageHtml("/"));
    }

    /** Una dirección sin extensión que se pide como página, no un recurso ni la API. */
    static boolean isPageRequest(HttpServletRequest request) {
        String method = request.getMethod();
        String path = request.getRequestURI();
        if (!"GET".equals(method) && !"HEAD".equals(method)) {
            return false;
        }
        if (path.startsWith("/api/") || path.equals("/api") || path.startsWith("/actuator")) {
            return false;
        }
        String lastSegment = path.substring(path.lastIndexOf('/') + 1);
        return !lastSegment.contains(".");
    }

    private static ResponseEntity.BodyBuilder html(HttpStatus status) {
        return ResponseEntity.status(status)
                .contentType(HTML_UTF8)
                .cacheControl(CacheControl.noCache())
                .header(HttpHeaders.CONTENT_LANGUAGE, "es");
    }

    private static Resource pageHtml(String path) {
        if (!"/".equals(path)) {
            Resource prerendered = new ClassPathResource("static" + path + "/index.html");
            if (prerendered.exists()) {
                return prerendered;
            }
        }
        return new ClassPathResource("static/index.html");
    }
}
