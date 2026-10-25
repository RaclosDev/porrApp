package com.porra.mundial.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Filtro de limitación de tasa (Rate Limiting) para proteger endpoints públicos contra ataques de denegación de servicio (DoS) y scraping masivo.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 50)
@Slf4j
public class RateLimitingFilter extends OncePerRequestFilter {

    private final Map<String, WindowCounter> requestCounts = new ConcurrentHashMap<>();

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
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isBlank()) {
            return xForwardedFor.split(",")[0].trim();
        }
        String xRealIp = request.getHeader("X-Real-IP");
        if (xRealIp != null && !xRealIp.isBlank()) {
            return xRealIp.trim();
        }
        return request.getRemoteAddr() != null ? request.getRemoteAddr() : "unknown";
    }

    private record WindowCounter(long minute, AtomicInteger count) {}
}
