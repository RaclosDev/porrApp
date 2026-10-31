package com.porra.mundial.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Arrays;

/**
 * Protección CSRF de las rutas de {@code /api/auth/}, las únicas que usan la cookie del refresh
 * token (o la crean, en el login). SameSite=Strict ya impide que la cookie salga en peticiones
 * de otros sitios, pero no de otros subdominios del mismo sitio; por eso además se exige que
 * la petición venga de la propia aplicación:
 * <ul>
 *   <li>con cabecera {@code Origin} (el navegador la pone en todo POST y una página no puede
 *       cambiarla), que sea el mismo origen que la API o uno de {@code app.cors.allowed-origins};</li>
 *   <li>sin {@code Origin}, solo con {@code Sec-Fetch-Site: same-origin}.</li>
 * </ul>
 * El resto de la API se autentica con la cabecera Authorization, que el navegador nunca añade
 * por su cuenta, así que no necesita esta comprobación.
 */
@Component
@Slf4j
public class CsrfOriginFilter extends OncePerRequestFilter {

    private static final String PROTECTED_PREFIX = "/api/auth/";

    private final CorsConfiguration allowedOrigins = new CorsConfiguration();

    public CsrfOriginFilter(
            @Value("${app.cors.allowed-origins:https://porra.raclos.es,http://localhost:5173,http://localhost:8080}")
            String allowedOrigins) {
        this.allowedOrigins.setAllowedOriginPatterns(Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(origin -> !origin.isEmpty())
                .toList());
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return !"POST".equalsIgnoreCase(request.getMethod()) || path == null || !path.startsWith(PROTECTED_PREFIX);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        if (comesFromTheApp(request)) {
            filterChain.doFilter(request, response);
            return;
        }
        log.warn("Petición a {} rechazada por su origen: Origin={}, Sec-Fetch-Site={}", request.getRequestURI(),
                request.getHeader(HttpHeaders.ORIGIN), request.getHeader("Sec-Fetch-Site"));
        response.setStatus(HttpStatus.FORBIDDEN.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        response.getWriter().write("{\"error\": \"Origen de la petición no permitido.\"}");
    }

    private boolean comesFromTheApp(HttpServletRequest request) {
        String origin = request.getHeader(HttpHeaders.ORIGIN);
        if (origin == null) {
            return "same-origin".equals(request.getHeader("Sec-Fetch-Site"));
        }
        // isCorsRequest compara Origin con el esquema, host y puerto de la petición.
        return !CorsUtils.isCorsRequest(request) || allowedOrigins.checkOrigin(origin) != null;
    }
}
