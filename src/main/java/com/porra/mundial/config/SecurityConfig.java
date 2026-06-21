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

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            // Desactivamos CSRF porque nuestra API es REST y no usa cookies de sesión
            .csrf(csrf -> csrf.disable())
            
            // Habilitar CORS si es necesario (generalmente Spring Boot autoconfigura si tenemos @CrossOrigin o un filtro global)
            .cors(cors -> {})
            
            // Configurar política de sesión sin estado (Stateless)
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            
            // Configurar reglas de autorización de rutas
            .authorizeHttpRequests(auth -> auth
                // Rutas públicas (Login y lecturas de la app)
                .requestMatchers("/api/admin/login").permitAll()
                .requestMatchers("/api/auth/google/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/bets").permitAll()
                .requestMatchers("/api/matches/**").permitAll()
                .requestMatchers("/api/standings/**").permitAll()
                .requestMatchers("/api/scorers/**").permitAll()
                .requestMatchers("/api/teams/odds").permitAll()
                .requestMatchers("/api/leaderboard").permitAll()
                .requestMatchers("/api/presence/**").permitAll()
                .requestMatchers("/api/ws").permitAll()
                
                // Rutas protegidas (Crear porra, editar porra, admin)
                .requestMatchers(HttpMethod.POST, "/api/bets").authenticated()
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.PUT, "/api/bets/**").authenticated()
                .requestMatchers(HttpMethod.DELETE, "/api/bets/**").authenticated()
                
                // Por seguridad extra, cualquier otra petición a /api/ requiere autenticación
                .requestMatchers("/api/**").authenticated()

                // Permitir acceso a estáticos (H2 console, imágenes, CSS, JS) - DEBE IR AL FINAL
                .requestMatchers("/h2-console/**").permitAll()
                .requestMatchers("/**").permitAll() 
            )
            .httpBasic(basic -> basic.disable())
            .formLogin(form -> form.disable())
            // Necesario para que funcione H2 Console con Spring Security
            .headers(headers -> headers.frameOptions(frame -> frame.disable()))
            
            // Añadir el filtro JWT antes del filtro de autenticación estándar
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
