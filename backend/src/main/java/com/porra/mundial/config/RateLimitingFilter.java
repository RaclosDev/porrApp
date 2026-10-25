package com.porra.mundial.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Filtro de limitación de tasa (Rate Limiting) basado en ventana deslizante en memoria.
 * Protege contra fuerza bruta en login de administración (5 req/min) y DoS en endpoints públicos (120 req/min).
 */
@Component
@Slf4j
public class RateLimitingFilter extends OncePerRequestFilter {

    private final Map<String, WindowCounter> requestCounts = new ConcurrentHashMap<>();
    private final Map<String, WindowCounter> adminLoginCounts = new ConcurrentHashMap<>();

    @Value("${app.rate-limiting.enabled:true}")
    private boolean enabled;

    @Value("${app.rate-limiting.max-requests-per-minute:120}")
    private int maxRequestsPerMinute;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        if (!enabled) {
            filterChain.doFilter(request, response);
            return;
        }

        String path = request.getRequestURI();

        // 1. Límite estricto anti-fuerza bruta para login administrativo (5 peticiones/minuto)
        if ("/api/admin/login".equals(path)) {
            String clientIp = getClientIp(request);
            if (!isAllowedAdminLogin(clientIp)) {
                log.warn("Límite de intentos de login administrativo excedido para IP: {}", clientIp);
                response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
                response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                response.setHeader("Retry-After", "60");
                response.getWriter().write("{\"error\": \"Demasiados intentos de acceso administrativo. Espera un minuto.\"}");
                return;
            }
        }

        // 2. Límite general para endpoints expuestos
        if (isRateLimitedPath(path)) {
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

    private boolean isRateLimitedPath(String path) {
        if (path == null) return false;
        return path.startsWith("/api/standings") ||
               path.startsWith("/api/matches") ||
               path.startsWith("/api/predictions") ||
               path.startsWith("/api/bets") ||
               path.startsWith("/api/leaderboard") ||
               path.startsWith("/api/admin/login") ||
               path.startsWith("/api/auth/");
    }

    private boolean isAllowedAdminLogin(String clientIp) {
        long currentMinute = System.currentTimeMillis() / 60000;
        WindowCounter counter = adminLoginCounts.compute(clientIp, (ip, existing) -> {
            if (existing == null || existing.minute != currentMinute) {
                return new WindowCounter(currentMinute, new AtomicInteger(1));
            }
            existing.count.incrementAndGet();
            return existing;
        });

        if (adminLoginCounts.size() > 1000) {
            adminLoginCounts.entrySet().removeIf(entry -> entry.getValue().minute < currentMinute - 1);
        }

        return counter.count.get() <= 5;
    }

    private boolean isAllowed(String clientIp) {
        long currentMinute = System.currentTimeMillis() / 60000;
        WindowCounter counter = requestCounts.compute(clientIp, (ip, existing) -> {
            if (existing == null || existing.minute != currentMinute) {
                return new WindowCounter(currentMinute, new AtomicInteger(1));
            }
            existing.count.incrementAndGet();
            return existing;
        });

        if (requestCounts.size() > 5000) {
            requestCounts.entrySet().removeIf(entry -> entry.getValue().minute < currentMinute - 1);
        }

        return counter.count.get() <= maxRequestsPerMinute;
    }

    private String getClientIp(HttpServletRequest request) {
        // En Render / Cloudflare, CF-Connecting-IP es inyectada por el proxy de borde y no puede ser falsificada
        String cfConnectingIp = request.getHeader("CF-Connecting-IP");
        if (cfConnectingIp != null && !cfConnectingIp.isBlank()) {
            return cfConnectingIp.trim();
        }
        // Spring Boot con ForwardedHeaderFilter resuelve la IP del cliente de forma segura en getRemoteAddr()
        String remoteAddr = request.getRemoteAddr();
        if (remoteAddr != null && !remoteAddr.isBlank()) {
            return remoteAddr.trim();
        }
        String xRealIp = request.getHeader("X-Real-IP");
        if (xRealIp != null && !xRealIp.isBlank()) {
            return xRealIp.trim();
        }
        return "127.0.0.1";
    }

    private record WindowCounter(long minute, AtomicInteger count) {}
}
