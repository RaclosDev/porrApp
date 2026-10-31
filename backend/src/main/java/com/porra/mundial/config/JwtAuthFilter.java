package com.porra.mundial.config;

import com.porra.mundial.model.UserAccount;
import com.porra.mundial.repository.UserAccountRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.Optional;

/**
 * Autentica la petición con el access token de la cabecera {@code Authorization: Bearer}.
 * Resuelve la cuenta por su id estable y expone el email actual a los servicios.
 */
@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private static final String BEARER_PREFIX = "Bearer ";

    private final JwtUtil jwtUtil;
    private final UserAccountRepository users;

    public JwtAuthFilter(JwtUtil jwtUtil, UserAccountRepository users) {
        this.jwtUtil = jwtUtil;
        this.users = users;
    }

    /** Token de la cabecera Authorization, o null si no viene. */
    public static String bearerToken(HttpServletRequest request) {
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        return header != null && header.startsWith(BEARER_PREFIX) ? header.substring(BEARER_PREFIX.length()) : null;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        String token = bearerToken(request);
        if (token != null && SecurityContextHolder.getContext().getAuthentication() == null) {
            jwtUtil.verify(token).flatMap(this::resolveAccount).ifPresent(user -> {
                UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
                        user.getGoogleEmail(), null, List.of(new SimpleGrantedAuthority("ROLE_USER")));
                authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(authToken);
            });
        }

        filterChain.doFilter(request, response);
    }

    private Optional<UserAccount> resolveAccount(JwtUtil.VerifiedToken token) {
        if (!token.legacy()) {
            return users.findById(token.userId());
        }
        // Un email reciclado no puede dar acceso a una cuenta nueva o ya vinculada por su sub.
        return users.findByGoogleEmail(token.email()).filter(user -> user.getGoogleSub() == null);
    }
}
