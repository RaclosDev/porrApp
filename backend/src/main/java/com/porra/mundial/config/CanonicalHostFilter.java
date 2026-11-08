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
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Redirige a porrapp.app con un 301 que conserva ruta y query los demás nombres que llegan a esta
 * app: www, el dominio antiguo (porra.raclos.es) y el dominio de Railway. Así los buscadores y los
 * enlaces antiguos, incluidas las invitaciones, suman en una sola dirección.
 *
 * <p>Los archivos de verificación de Search Console no se redirigen: la propiedad del dominio
 * antiguo tiene que seguir verificada para que valga el «Cambio de dirección».
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class CanonicalHostFilter extends OncePerRequestFilter {

    static final Set<String> REDIRECTED_HOSTS =
            Set.of("www.porrapp.app", "porra.raclos.es", "porrapp-app-production.up.railway.app");
    static final String CANONICAL_ORIGIN = "https://porrapp.app";
    private static final Pattern SEARCH_CONSOLE_FILE = Pattern.compile("/google[0-9a-f]+\\.html");

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String host = request.getServerName();
        if (host == null
                || !REDIRECTED_HOSTS.contains(host.toLowerCase(Locale.ROOT))
                || SEARCH_CONSOLE_FILE.matcher(request.getRequestURI()).matches()) {
            chain.doFilter(request, response);
            return;
        }
        String query = request.getQueryString();
        String target = CANONICAL_ORIGIN + request.getRequestURI() + (query == null ? "" : "?" + query);
        response.setStatus(HttpServletResponse.SC_MOVED_PERMANENTLY);
        response.setHeader(HttpHeaders.LOCATION, target);
    }
}
