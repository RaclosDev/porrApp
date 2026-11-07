package com.porra.mundial.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Redirige www.porrapp.app a porrapp.app con un 301 que conserva ruta y query, para que los
 * buscadores y los enlaces con www sumen en una sola dirección.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class CanonicalHostFilter extends OncePerRequestFilter {

    static final String WWW_HOST = "www.porrapp.app";
    static final String CANONICAL_ORIGIN = "https://porrapp.app";

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        if (!WWW_HOST.equalsIgnoreCase(request.getServerName())) {
            chain.doFilter(request, response);
            return;
        }
        String query = request.getQueryString();
        String target = CANONICAL_ORIGIN + request.getRequestURI() + (query == null ? "" : "?" + query);
        response.setStatus(HttpServletResponse.SC_MOVED_PERMANENTLY);
        response.setHeader(HttpHeaders.LOCATION, target);
    }
}
