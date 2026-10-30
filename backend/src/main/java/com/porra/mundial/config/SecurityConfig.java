package com.porra.mundial.config;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;

/**
 * Configuración global de Spring Security.
 * Define las reglas de acceso (Rutas públicas vs privadas), registra RateLimitingFilter,
 * CsrfOriginFilter y JwtAuthFilter, e implementa cabeceras de seguridad HTTP endurecidas
 * (CSP, HSTS, X-Content-Type-Options, etc.).
 * <p>
 * El CSRF de Spring Security está desactivado: la API se autentica con la cabecera
 * Authorization, que el navegador no manda solo, y las rutas que usan la cookie del refresh
 * token ({@code /api/auth/}) las protegen SameSite=Strict y {@link CsrfOriginFilter}.
 * </p>
 */
@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final RateLimitingFilter rateLimitingFilter;
    private final CsrfOriginFilter csrfOriginFilter;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .cors(cors -> {})
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .exceptionHandling(ex -> ex.authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(HttpMethod.POST, "/api/auth/google/login").permitAll()
                // Refresco, logout y canje del JWT antiguo: se autentican con la cookie o el JWT.
                .requestMatchers(HttpMethod.POST, "/api/auth/session/**").permitAll()
                .requestMatchers("/actuator/health", "/actuator/health/liveness", "/actuator/info").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/ws").permitAll()
                .requestMatchers("/api/predictions/mine", "/api/groups/mine").authenticated()
                .requestMatchers(HttpMethod.GET,
                        "/api/groups/*/members").authenticated()
                // Lecturas públicas: cada controlador filtra los datos de ligas privadas.
                .requestMatchers(HttpMethod.GET,
                        "/api/predictions/**",
                        "/api/matches/**",
                        "/api/standings/**",
                        "/api/scorers/**",
                        "/api/rules/**",
                        "/api/teams/odds",
                        "/api/leaderboard", "/api/leaderboard/**",
                        "/api/groups/**",
                        "/api/users/*/avatar",
                        "/api/competitions/**").permitAll()
                .requestMatchers("/api/**").authenticated()
                .requestMatchers("/**").permitAll()
            )
            .httpBasic(basic -> basic.disable())
            .formLogin(form -> form.disable())
            .headers(headers -> headers
                .frameOptions(frame -> frame.sameOrigin())
                .contentTypeOptions(content -> {})
                .referrerPolicy(ref -> ref.policy(ReferrerPolicyHeaderWriter.ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN))
                .httpStrictTransportSecurity(hsts -> hsts
                    .includeSubDomains(true)
                    .maxAgeInSeconds(31536000)
                    .preload(true)
                )
                .contentSecurityPolicy(csp -> csp
                    .policyDirectives("default-src 'self'; " +
                            "script-src 'self' 'unsafe-inline' https://accounts.google.com https://apis.google.com https://pagead2.googlesyndication.com; " +
                            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
                            "font-src 'self' https://fonts.gstatic.com; " +
                            // blob: para la vista previa local de una foto antes de subirla.
                            "img-src 'self' data: blob: https:; " +
                            "connect-src 'self' ws: wss: https://accounts.google.com https://site.api.espn.com https://a.espncdn.com; " +
                            "frame-src 'self' https://accounts.google.com https://googleads.g.doubleclick.net;")
                )
                .permissionsPolicy(perm -> perm
                    .policy("camera=(), microphone=(), geolocation=()")
                )
            )
            .addFilterBefore(rateLimitingFilter, UsernamePasswordAuthenticationFilter.class)
            .addFilterBefore(csrfOriginFilter, UsernamePasswordAuthenticationFilter.class)
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
