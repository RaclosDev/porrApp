package app.porrapp.config;

import jakarta.servlet.http.HttpServletRequest;

import java.security.MessageDigest;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

/**
 * Marca de las peticiones que el propio servidor se hace para montar la demo pública
 * ({@code DemoSnapshotService}). La clave es aleatoria y solo vive en memoria de este proceso, así
 * que nadie de fuera puede llevarla; con ella esas peticiones no gastan el cupo de lecturas.
 */
public final class DemoCrawl {

    public static final String HEADER = "X-Demo-Crawl";
    private static final String KEY = UUID.randomUUID().toString();

    private DemoCrawl() {
    }

    public static String key() {
        return KEY;
    }

    static boolean isCrawl(HttpServletRequest request) {
        String sent = request.getHeader(HEADER);
        return sent != null && MessageDigest.isEqual(
                sent.getBytes(StandardCharsets.UTF_8), KEY.getBytes(StandardCharsets.UTF_8));
    }
}
