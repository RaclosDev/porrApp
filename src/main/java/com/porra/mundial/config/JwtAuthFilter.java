package com.porra.mundial.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;

    @Value("${app.admins:Admin}")
    private List<String> appAdmins;

    @Value("${app.admin-emails:raclosnegocios@gmail.com}")
    private List<String> adminEmails;

    public JwtAuthFilter(JwtUtil jwtUtil) {
        this.jwtUtil = jwtUtil;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        // 1. Obtener la cabecera "Authorization"
        String authHeader = request.getHeader("Authorization");
        String token = null;

        // Por compatibilidad temporal durante la migración, si envían X-Admin-Token lo intentamos leer
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            String legacyToken = request.getHeader("X-Admin-Token");
            if (legacyToken != null && !legacyToken.isEmpty()) {
                token = legacyToken;
            }
        } else {
            // Extraer el token de "Bearer <token>"
            token = authHeader.substring(7);
        }

        if (token != null && jwtUtil.validateToken(token)) {
            String username = jwtUtil.extractUsername(token);

            // Si el token es válido y no hay autenticación activa en este hilo
            if (username != null && SecurityContextHolder.getContext().getAuthentication() == null) {
                List<GrantedAuthority> authorities = new ArrayList<>();
                
                String extractedEmail = jwtUtil.extractEmail(token);
                final String email = extractedEmail == null ? username : extractedEmail; // username is the email now

                boolean isSuperAdmin = adminEmails.stream().anyMatch(ae -> email.equalsIgnoreCase(ae));
                
                if (isSuperAdmin) {
                    authorities.add(new SimpleGrantedAuthority("ROLE_ADMIN"));
                } else {
                    authorities.add(new SimpleGrantedAuthority("ROLE_USER"));
                }

                UsernamePasswordAuthenticationToken authToken =
                        new UsernamePasswordAuthenticationToken(email, null, authorities);
                authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));

                // Guardamos la autenticación en el contexto de seguridad
                SecurityContextHolder.getContext().setAuthentication(authToken);
            }
        }

        // Continuamos con la cadena de filtros
        filterChain.doFilter(request, response);
    }
}
