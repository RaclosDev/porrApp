package com.porra.mundial.config;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
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
 * e implementa cabeceras de seguridad HTTP endurecidas.
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
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/admin/login").permitAll()
                .requestMatchers("/api/auth/google/**").permitAll()
                .requestMatchers("/api/predictions/mine", "/api/bets/mine").authenticated()
                .requestMatchers(HttpMethod.GET, "/api/predictions/**", "/api/bets/**").permitAll()
                .requestMatchers("/api/matches/**").permitAll()
                .requestMatchers("/api/standings/**").permitAll()
                .requestMatchers("/api/scorers/**").permitAll()
                .requestMatchers("/api/rules/**").permitAll()
                .requestMatchers("/actuator/health", "/actuator/info").permitAll()
                .requestMatchers("/api/teams/odds").permitAll()
                .requestMatchers("/api/leaderboard").permitAll()
                .requestMatchers("/api/presence/**").permitAll()
                .requestMatchers("/api/ws").permitAll()
                .requestMatchers("/api/groups/mine").authenticated()
                .requestMatchers(HttpMethod.GET, "/api/groups/**").permitAll()
                .requestMatchers("/api/competitions/**").permitAll()

                .requestMatchers(HttpMethod.POST, "/api/predictions", "/api/bets").authenticated()
                .requestMatchers(HttpMethod.PUT, "/api/predictions/**", "/api/bets/**").authenticated()
                .requestMatchers(HttpMethod.DELETE, "/api/predictions/**", "/api/bets/**").authenticated()

                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                .requestMatchers("/api/**").authenticated()

                .requestMatchers("/h2-console/**").permitAll()
                .requestMatchers("/**").permitAll()
            )
            .httpBasic(basic -> basic.disable())
            .formLogin(form -> form.disable())
            .headers(headers -> headers
                .frameOptions(frame -> frame.sameOrigin())
                .contentTypeOptions(content -> {})
                .referrerPolicy(ref -> ref.policy(ReferrerPolicyHeaderWriter.ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN))
            )
            .addFilterBefore(rateLimitingFilter, UsernamePasswordAuthenticationFilter.class)
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
