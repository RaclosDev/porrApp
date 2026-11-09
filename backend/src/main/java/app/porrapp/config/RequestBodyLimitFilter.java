package app.porrapp.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;

/**
 * Limita el tamaño del cuerpo de las peticiones que no son multipart (las subidas de imágenes
 * tienen sus propios límites en {@code spring.servlet.multipart.*}). Sin esto Jackson leería en
 * memoria un cuerpo de cualquier tamaño, también en {@code /api/client-errors}, que es anónimo.
 * <ul>
 *   <li>Con {@code Content-Length} por encima del límite se responde 413 sin leer nada.</li>
 *   <li>Sin {@code Content-Length} (chunked) se corta la lectura al pasar el límite con
 *       {@link BodyTooLargeException}, que {@code GlobalExceptionHandler} convierte en 413.</li>
 * </ul>
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
@Slf4j
public class RequestBodyLimitFilter extends OncePerRequestFilter {

    /** Cuerpo máximo de la API: muy por encima de una predicción o una jornada completa. */
    static final int MAX_BODY_BYTES = 256 * 1024;
    /** Los informes de errores del navegador se recortan a unos 3 KB; 16 KB sobran. */
    static final int MAX_CLIENT_ERROR_BYTES = 16 * 1024;
    private static final String CLIENT_ERRORS_PATH = "/api/client-errors";

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String method = request.getMethod();
        if ("GET".equalsIgnoreCase(method) || "HEAD".equalsIgnoreCase(method) || "OPTIONS".equalsIgnoreCase(method)) {
            return true;
        }
        String contentType = request.getContentType();
        return contentType != null && contentType.toLowerCase().startsWith("multipart/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        int limit = limitFor(request);
        long declared = request.getContentLengthLong();
        if (declared > limit) {
            log.warn("Cuerpo de {} bytes rechazado en {} (máximo {})", declared, request.getRequestURI(), limit);
            response.setStatus(HttpStatus.PAYLOAD_TOO_LARGE.value());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.setCharacterEncoding("UTF-8");
            response.getWriter().write("{\"error\": \"La petición es demasiado grande.\"}");
            return;
        }
        filterChain.doFilter(declared >= 0 ? request : new LimitedBodyRequest(request, limit), response);
    }

    static int limitFor(HttpServletRequest request) {
        String path = request.getRequestURI();
        return path != null && path.startsWith(CLIENT_ERRORS_PATH) ? MAX_CLIENT_ERROR_BYTES : MAX_BODY_BYTES;
    }

    /** Lectura que pasa del límite de un cuerpo sin {@code Content-Length}. */
    public static class BodyTooLargeException extends IOException {
        public BodyTooLargeException(int limit) {
            super("El cuerpo de la petición supera " + limit + " bytes");
        }
    }

    private static final class LimitedBodyRequest extends HttpServletRequestWrapper {
        private final int limit;
        private ServletInputStream stream;

        LimitedBodyRequest(HttpServletRequest request, int limit) {
            super(request);
            this.limit = limit;
        }

        @Override
        public ServletInputStream getInputStream() throws IOException {
            if (stream == null) {
                stream = new LimitedInputStream(super.getInputStream(), limit);
            }
            return stream;
        }

        @Override
        public BufferedReader getReader() throws IOException {
            String encoding = getCharacterEncoding();
            Charset charset = encoding != null ? Charset.forName(encoding) : StandardCharsets.UTF_8;
            return new BufferedReader(new InputStreamReader(getInputStream(), charset));
        }
    }

    private static final class LimitedInputStream extends ServletInputStream {
        private final ServletInputStream delegate;
        private final int limit;
        private long read;

        LimitedInputStream(ServletInputStream delegate, int limit) {
            this.delegate = delegate;
            this.limit = limit;
        }

        @Override
        public int read() throws IOException {
            int value = delegate.read();
            if (value != -1) count(1);
            return value;
        }

        @Override
        public int read(byte[] buffer, int offset, int length) throws IOException {
            int n = delegate.read(buffer, offset, length);
            if (n > 0) count(n);
            return n;
        }

        private void count(int n) throws IOException {
            read += n;
            if (read > limit) {
                throw new BodyTooLargeException(limit);
            }
        }

        @Override
        public boolean isFinished() {
            return delegate.isFinished();
        }

        @Override
        public boolean isReady() {
            return delegate.isReady();
        }

        @Override
        public void setReadListener(ReadListener listener) {
            delegate.setReadListener(listener);
        }
    }
}
