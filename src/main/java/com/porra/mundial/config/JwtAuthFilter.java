package com.porra.mundial.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.ArrayList;

@Component
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;

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
                java.util.List<org.springframework.security.core.GrantedAuthority> authorities = new java.util.ArrayList<>();
                
                String email = jwtUtil.extractEmail(token);
                boolean isSuperAdmin = "admin".equals(username) || "RaclosAdmin".equalsIgnoreCase(username) || 
                                       (email != null && email.toLowerCase().contains("raclosnegocios"));
                
                if (isSuperAdmin) {
                    authorities.add(new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_ADMIN"));
                } else {
                    authorities.add(new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_USER"));
                }

                UsernamePasswordAuthenticationToken authToken =
                        new UsernamePasswordAuthenticationToken(username, null, authorities);
                authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));

                // Guardamos la autenticación en el contexto de seguridad
                SecurityContextHolder.getContext().setAuthentication(authToken);
            }
        }

        // Continuamos con la cadena de filtros
        filterChain.doFilter(request, response);
    }
}
