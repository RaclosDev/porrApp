package com.porra.mundial.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;

/**
 * Da acceso a {@code /actuator/prometheus} a quien envíe {@code Authorization: Bearer <app.metrics.token>}
 * (el recolector de métricas). Sin token configurado no entra nadie: el endpoint expone datos internos.
 */
@Component
public class MetricsTokenFilter extends OncePerRequestFilter {

    static final String ROLE = "METRICS";
    private static final String PATH = "/actuator/prometheus";

    private final byte[] token;

    public MetricsTokenFilter(@Value("${app.metrics.token:}") String token) {
        this.token = token.isBlank() ? null : token.getBytes(StandardCharsets.UTF_8);
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return token == null || !PATH.equals(request.getRequestURI());
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String presented = JwtAuthFilter.bearerToken(request);
        if (presented != null && MessageDigest.isEqual(token, presented.getBytes(StandardCharsets.UTF_8))) {
            SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                    "metrics", null, List.of(new SimpleGrantedAuthority("ROLE_" + ROLE))));
        }
        chain.doFilter(request, response);
    }
}
