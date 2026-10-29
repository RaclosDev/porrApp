package com.porra.mundial.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletRequestWrapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Enumeration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Filtro de limitación de tasa (Rate Limiting) basado en ventana deslizante en memoria.
 * Protege contra fuerza bruta en el login con Google (15 req/min) y DoS en endpoints públicos (120 req/min).
 */
@Component
@Slf4j
public class RateLimitingFilter extends OncePerRequestFilter {

    private final Map<String, WindowCounter> requestCounts = new ConcurrentHashMap<>();
    private final Map<String, WindowCounter> authLoginCounts = new ConcurrentHashMap<>();

    @Value("${app.rate-limiting.enabled:true}")
    private boolean enabled;

    @Value("${app.rate-limiting.max-requests-per-minute:120}")
    private int maxRequestsPerMinute;

    /**
     * Proxies de confianza delante de la app que añaden un salto a X-Forwarded-For. En Railway
     * es 1 (su proxy de borde). Si se pone Cloudflare delante, 2.
     */
    @Value("${app.rate-limiting.trusted-proxy-hops:1}")
    private int trustedProxyHops = 1;

    /** Tope de IPs con contador en memoria: sin él, el mapa crece con cada IP distinta. */
    @Value("${app.rate-limiting.max-tracked-clients:10000}")
    private int maxTrackedClients = 10_000;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        if (!enabled) {
            filterChain.doFilter(request, response);
            return;
        }

        String path = request.getRequestURI();

        // 1. Límite estricto anti-abuso para endpoints de login y autenticación (15 peticiones/minuto)
        if (path != null && path.startsWith("/api/auth/google/login")) {
            String clientIp = getClientIp(request);
            if (!isAllowedAuthLogin(clientIp)) {
                log.warn("Límite de intentos de login excedido para IP: {}", clientIp);
                response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
                response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                response.setHeader("Retry-After", "60");
                response.getWriter().write("{\"error\": \"Demasiados intentos de autenticación. Espera un minuto.\"}");
                return;
            }
        }

        // 2. Límite general para endpoints expuestos
        if (isRateLimitedPath(path, request.getMethod())) {
            String clientIp = getClientIp(request);
            if (!isAllowed(clientIp)) {
                log.warn("Rate limit exceeded for IP: {} on path: {}", clientIp, path);
                response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
                response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                response.setHeader("Retry-After", "60");
                response.getWriter().write("{\"error\": \"Demasiadas peticiones. Por favor, espera un minuto antes de reintentar.\"}");
                return;
            }
        }

        filterChain.doFilter(request, response);
    }

    private boolean isRateLimitedPath(String path, String method) {
        if (path == null) return false;
        return path.startsWith("/api/standings") ||
               path.startsWith("/api/matches") ||
               path.startsWith("/api/predictions") ||
               path.startsWith("/api/leaderboard") ||
               path.startsWith("/api/auth/") ||
               path.startsWith("/api/users/me") ||
               // Invitaciones: sin límite se podrían probar códigos por fuerza bruta.
               path.startsWith("/api/groups/preview/") ||
               path.startsWith("/join/") ||
               (path.equals("/api/groups/join") && "POST".equalsIgnoreCase(method)) ||
               (path.startsWith("/api/groups/") && path.endsWith("/image")) ||
               (path.startsWith("/api/users/") && path.endsWith("/avatar"));
    }

    private boolean isAllowedAuthLogin(String clientIp) {
        return countAndCheck(authLoginCounts, clientIp, 15);
    }

    private boolean isAllowed(String clientIp) {
        return countAndCheck(requestCounts, clientIp, maxRequestsPerMinute);
    }

    private boolean countAndCheck(Map<String, WindowCounter> counts, String clientIp, int limit) {
        long currentMinute = System.currentTimeMillis() / 60000;
        if (counts.size() >= maxTrackedClients && !counts.containsKey(clientIp)) {
            counts.entrySet().removeIf(entry -> entry.getValue().minute != currentMinute);
            if (counts.size() >= maxTrackedClients) {
                // Todas son de este minuto: se empieza de cero antes que dejar crecer la memoria.
                log.warn("Rate limit: {} IPs distintas en un minuto; se reinician los contadores.", counts.size());
                counts.clear();
            }
        }

        WindowCounter counter = counts.compute(clientIp, (ip, existing) -> {
            if (existing == null || existing.minute != currentMinute) {
                return new WindowCounter(currentMinute, new AtomicInteger(1));
            }
            existing.count.incrementAndGet();
            return existing;
        });

        return counter.count.get() <= limit;
    }

    int trackedClients() {
        return requestCounts.size();
    }

    /**
     * IP del cliente. Las cabeceras que manda el cliente no cuentan: CF-Connecting-IP y X-Real-IP
     * se ignoran, y de X-Forwarded-For solo vale el salto que añadió el último proxy de confianza
     * (el último valor con un solo proxy). Se lee de la petición original porque
     * ForwardedHeaderFilter (server.forward-headers-strategy=framework) oculta la cabecera y pone
     * en getRemoteAddr() su primer valor, que elige el cliente.
     */
    String getClientIp(HttpServletRequest request) {
        ServletRequest original = request;
        while (original instanceof ServletRequestWrapper wrapper) {
            original = wrapper.getRequest();
        }
        HttpServletRequest raw = original instanceof HttpServletRequest http ? http : request;

        if (trustedProxyHops > 0) {
            List<String> hops = new ArrayList<>();
            Enumeration<String> headers = raw.getHeaders("X-Forwarded-For");
            while (headers != null && headers.hasMoreElements()) {
                for (String hop : headers.nextElement().split(",")) {
                    if (!hop.isBlank()) hops.add(hop.trim());
                }
            }
            if (!hops.isEmpty()) {
                return hops.get(Math.max(0, hops.size() - trustedProxyHops));
            }
        }

        String remoteAddr = raw.getRemoteAddr();
        return remoteAddr != null && !remoteAddr.isBlank() ? remoteAddr.trim() : "unknown";
    }

    private record WindowCounter(long minute, AtomicInteger count) {}
}
