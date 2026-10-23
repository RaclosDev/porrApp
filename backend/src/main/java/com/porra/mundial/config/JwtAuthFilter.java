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

        String authHeader = request.getHeader("Authorization");
        String token = null;

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            String legacyToken = request.getHeader("X-Admin-Token");
            if (legacyToken != null && !legacyToken.isEmpty()) {
                token = legacyToken;
            }
        } else {
            token = authHeader.substring(7);
        }

        if (token != null && jwtUtil.validateToken(token)) {
            String username = jwtUtil.extractUsername(token);

            if (username != null && SecurityContextHolder.getContext().getAuthentication() == null) {
                List<GrantedAuthority> authorities = new ArrayList<>();
                
                String extractedEmail = jwtUtil.extractEmail(token);
                final String email = extractedEmail == null ? username : extractedEmail;

                boolean isSuperAdmin = (adminEmails != null && adminEmails.stream().anyMatch(ae -> email.equalsIgnoreCase(ae)))
                        || (appAdmins != null && appAdmins.stream().anyMatch(a -> email.equalsIgnoreCase(a)));
                
                if (isSuperAdmin) {
                    authorities.add(new SimpleGrantedAuthority("ROLE_ADMIN"));
                } else {
                    authorities.add(new SimpleGrantedAuthority("ROLE_USER"));
                }

                UsernamePasswordAuthenticationToken authToken =
                        new UsernamePasswordAuthenticationToken(email, null, authorities);
                authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));

                SecurityContextHolder.getContext().setAuthentication(authToken);
            }
        }

        filterChain.doFilter(request, response);
    }
}
