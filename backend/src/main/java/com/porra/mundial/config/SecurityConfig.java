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
 * Define las reglas de acceso (Rutas públicas vs privadas), desactiva CSRF
 * (por ser una API Stateless con JWT), registra RateLimitingFilter y JwtAuthFilter,
 * e implementa cabeceras de seguridad HTTP endurecidas (CSP, HSTS, X-Content-Type-Options, etc.).
 */
@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final RateLimitingFilter rateLimitingFilter;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .cors(cors -> {})
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .exceptionHandling(ex -> ex.authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(HttpMethod.POST, "/api/auth/google/login").permitAll()
                .requestMatchers("/actuator/health", "/actuator/info").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/ws").permitAll()
                .requestMatchers("/api/predictions/mine", "/api/bets/mine", "/api/groups/mine").authenticated()
                // Lecturas públicas: cada controlador filtra los datos de ligas privadas.
                .requestMatchers(HttpMethod.GET,
                        "/api/predictions/**", "/api/bets/**",
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
                            "img-src 'self' data: https:; " +
                            "connect-src 'self' ws: wss: https://accounts.google.com https://site.api.espn.com https://a.espncdn.com; " +
                            "frame-src 'self' https://accounts.google.com https://googleads.g.doubleclick.net;")
                )
                .permissionsPolicy(perm -> perm
                    .policy("camera=(), microphone=(), geolocation=()")
                )
            )
            .addFilterBefore(rateLimitingFilter, UsernamePasswordAuthenticationFilter.class)
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
