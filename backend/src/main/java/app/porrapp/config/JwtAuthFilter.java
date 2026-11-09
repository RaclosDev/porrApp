package app.porrapp.config;

import app.porrapp.model.UserAccount;
import app.porrapp.repository.UserAccountRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
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
 * Resuelve la cuenta por su id estable y expone el email actual a los servicios. El id de la cuenta (nunca el
 * email) queda en el MDC como {@code userId} para que cada línea de log diga de quién era la petición.
 */
@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private static final String BEARER_PREFIX = "Bearer ";
    static final String MDC_USER_ID = "userId";

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
                MDC.put(MDC_USER_ID, String.valueOf(user.getId()));
            });
        }

        try {
            filterChain.doFilter(request, response);
        } finally {
            MDC.remove(MDC_USER_ID);
        }
    }

    private Optional<UserAccount> resolveAccount(JwtUtil.VerifiedToken token) {
        return users.findById(token.userId());
    }
}
