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



/**

 * Configuración global de Spring Security.

 * Define las reglas de acceso (Rutas públicas vs privadas), desactiva CSRF

 * (por ser una API Stateless con JWT) y registra el filtro JWT personalizado.

 */

@Configuration

@EnableWebSecurity

@RequiredArgsConstructor

public class SecurityConfig {



    private final JwtAuthFilter jwtAuthFilter;



    /**

     * Construye la cadena de filtros de seguridad HTTP de Spring.

     * 

     * @param http El constructor de seguridad HTTP.

     * @return La cadena de filtros configurada lista para interceptar peticiones.

     * @throws Exception En caso de error de configuración.

     */

    @Bean

    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {

        http

            // Desactivamos CSRF porque nuestra API es REST y no usa cookies de sesión tradicionales

            .csrf(csrf -> csrf.disable())

            

            // Habilitar CORS genérico. La configuración final está en WebConfig.java

            .cors(cors -> {})

            

            // Configurar política de sesión sin estado (Stateless) - no se guardan sesiones en memoria del servidor

            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))

            

            // Configurar reglas de autorización de rutas (Whitelist de endpoints)

            .authorizeHttpRequests(auth -> auth

                // Rutas públicas: Autenticación, Google Auth y APIs de solo lectura

                .requestMatchers("/api/admin/login").permitAll()

                .requestMatchers("/api/auth/google/**").permitAll()

                .requestMatchers("/api/bets/mine", "/api/predictions/mine").authenticated()

                .requestMatchers(HttpMethod.GET, "/api/bets/**", "/api/predictions/**").permitAll()

                .requestMatchers("/api/matches/**").permitAll()

                .requestMatchers("/api/standings/**").permitAll()

                .requestMatchers("/api/scorers/**").permitAll()

                .requestMatchers("/api/teams/odds").permitAll()

                .requestMatchers("/api/leaderboard").permitAll()

                .requestMatchers("/api/presence/**").permitAll()

                .requestMatchers("/api/ws").permitAll() // WebSocket endpoint público

                

                // Rutas protegidas: Requieren JWT token con ROLE_USER

                .requestMatchers(HttpMethod.POST, "/api/bets", "/api/predictions").authenticated()

                .requestMatchers(HttpMethod.PUT, "/api/bets/**", "/api/predictions/**").authenticated()

                .requestMatchers(HttpMethod.DELETE, "/api/bets/**", "/api/predictions/**").authenticated()

                

                // Rutas críticas: Requieren JWT token de administrador con ROLE_ADMIN

                .requestMatchers("/api/admin/**").hasRole("ADMIN")

                

                // Por seguridad por defecto (deny by default en API), cualquier otra petición a /api/ requiere autenticación

                .requestMatchers("/api/**").authenticated()



                // Permitir acceso irrestricto a ficheros estáticos de React (index.html, JS, CSS, assets)

                // y consola H2 en entorno local. DEBE IR AL FINAL.

                .requestMatchers("/h2-console/**").permitAll()

                .requestMatchers("/**").permitAll() 

            )

            // Desactivar autenticación básica y login form (Ya que usamos JSON y JWT)

            .httpBasic(basic -> basic.disable())

            .formLogin(form -> form.disable())

            // Necesario para que funcione H2 Console incrustado en iframe con Spring Security

            .headers(headers -> headers.frameOptions(frame -> frame.sameOrigin()))

            

            // Añadir nuestro filtro JWT personalizado antes del filtro estándar de usuario/contraseña

            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);



        return http.build();

    }

}

