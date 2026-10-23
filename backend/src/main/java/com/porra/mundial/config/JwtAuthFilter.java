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

/**
 * Filtro de seguridad que se ejecuta una vez por cada petición HTTP (OncePerRequestFilter).
 * Se encarga de interceptar las llamadas, extraer el token JWT de las cabeceras,
 * validarlo e inyectar el usuario autenticado en el contexto de seguridad de Spring (SecurityContext).
 */
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

    /**
     * Intercepta la petición para comprobar si trae credenciales (Bearer token).
     * 
     * @param request La petición HTTP entrante.
     * @param response La respuesta HTTP saliente.
     * @param filterChain La cadena de filtros para continuar el procesamiento.
     */
    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        // Obtener la cabecera "Authorization"
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

        // Si existe un token y su firma es válida (no expirado, clave secreta correcta)
        if (token != null && jwtUtil.validateToken(token)) {
            String username = jwtUtil.extractUsername(token);

            // Si el token es válido y no hay autenticación activa en este hilo
            if (username != null && SecurityContextHolder.getContext().getAuthentication() == null) {
                List<GrantedAuthority> authorities = new ArrayList<>();
                
                String extractedEmail = jwtUtil.extractEmail(token);
                final String email = extractedEmail == null ? username : extractedEmail; // username is the email now

                // Determinar Roles: Si el email está en la lista de administradores, asignamos ROLE_ADMIN
                boolean isSuperAdmin = (adminEmails != null && adminEmails.stream().anyMatch(ae -> email.equalsIgnoreCase(ae)))
                        || (appAdmins != null && appAdmins.stream().anyMatch(a -> email.equalsIgnoreCase(a)));
                
                if (isSuperAdmin) {
                    authorities.add(new SimpleGrantedAuthority("ROLE_ADMIN"));
                } else {
                    authorities.add(new SimpleGrantedAuthority("ROLE_USER"));
                }

                // Crear el token de Spring Security y registrarlo en el contexto de seguridad local
                UsernamePasswordAuthenticationToken authToken =
                        new UsernamePasswordAuthenticationToken(email, null, authorities);
                authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));

                // Guardamos la autenticación en el contexto de seguridad (Habilita anotaciones @PreAuthorize)
                SecurityContextHolder.getContext().setAuthentication(authToken);
            }
        }

        // Continuamos con la cadena de filtros permitiendo que el Request avance a los Controladores
        filterChain.doFilter(request, response);
    }
}
