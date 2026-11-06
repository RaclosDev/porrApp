package com.porra.mundial.config;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
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

    /** Lecturas que no exigen sesión (GET y HEAD). */
    private static final String[] PUBLIC_READS = {
            "/api/predictions/**",
            "/api/matches/**",
            "/api/standings/**",
            "/api/scorers/**",
            "/api/rules/**",
            "/api/teams/odds",
            "/api/leaderboard", "/api/leaderboard/**",
            "/api/groups/**",
            "/api/users/*/avatar/*",
            "/api/competitions/**"
    };

    /** Hash del contenido de &lt;script type="speculationrules"&gt; de frontend/index.html. */
    static final String INDEX_SPECULATION_RULES_HASH = "'sha256-I3eLRc1Jk/ZvRCXECwqrMwPVfsi5QuCkSMpeXQKg2Fw='";
    /** Hash de onload="this.media = 'all'" de la hoja de fuentes de frontend/index.html. */
    static final String INDEX_FONT_ONLOAD_HASH = "'sha256-C6b/4Iv4ZcrPnfjsnUI/tt1KLtFSZRbC4PywNhjbLfw='";

    private final JwtAuthFilter jwtAuthFilter;
    private final RateLimitingFilter rateLimitingFilter;
    private final CsrfOriginFilter csrfOriginFilter;
    private final MetricsTokenFilter metricsTokenFilter;

    /**
     * El filtro del token de métricas solo actúa dentro de la cadena de seguridad: registrado además como
     * filtro del servlet se ejecutaría antes, y la cadena no vería la autenticación que pone.
     */
    @Bean
    public FilterRegistrationBean<MetricsTokenFilter> metricsTokenFilterRegistration(MetricsTokenFilter filter) {
        FilterRegistrationBean<MetricsTokenFilter> registration = new FilterRegistrationBean<>(filter);
        registration.setEnabled(false);
        return registration;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .cors(cors -> {})
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .exceptionHandling(ex -> ex.authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(HttpMethod.POST, "/api/auth/google/login").permitAll()
                // Entrar con una llave de acceso: la propia firma de la llave autentica.
                .requestMatchers(HttpMethod.POST, "/api/auth/passkeys/login", "/api/auth/passkeys/login/options").permitAll()
                // Refresco y logout: se autentican con la cookie del refresh token.
                .requestMatchers(HttpMethod.POST, "/api/auth/session/**").permitAll()
                // Errores del navegador, también de visitantes sin sesión; con límite por IP.
                .requestMatchers(HttpMethod.POST, "/api/client-errors").permitAll()
                .requestMatchers("/actuator/health", "/actuator/health/liveness", "/actuator/info").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/ws").permitAll()
                .requestMatchers("/api/predictions/mine", "/api/groups/mine", "/api/groups/mine/summary").authenticated()
                .requestMatchers("/api/groups/*/members").authenticated()
                .requestMatchers("/api/groups/*/competition/**").authenticated()
                // Lecturas públicas: cada controlador filtra los datos de ligas privadas. HEAD sigue
                // las mismas reglas que GET para los monitores de disponibilidad.
                .requestMatchers(HttpMethod.GET, PUBLIC_READS).permitAll()
                .requestMatchers(HttpMethod.HEAD, PUBLIC_READS).permitAll()
                .requestMatchers("/api/**").authenticated()
                .requestMatchers("/actuator/prometheus").hasRole(MetricsTokenFilter.ROLE)
                .requestMatchers("/actuator/**").denyAll()
                .requestMatchers("/**").permitAll()
            )
            .httpBasic(basic -> basic.disable())
            .formLogin(form -> form.disable())
            .headers(headers -> headers
                .frameOptions(frame -> frame.deny())
                .contentTypeOptions(content -> {})
                .referrerPolicy(ref -> ref.policy(ReferrerPolicyHeaderWriter.ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN))
                .httpStrictTransportSecurity(hsts -> hsts
                    .includeSubDomains(true)
                    .maxAgeInSeconds(31536000)
                    .preload(true)
                )
                .contentSecurityPolicy(csp -> csp
                    .policyDirectives("default-src 'self'; " +
                            // Sin 'unsafe-inline': solo el script inline de index.html (reglas de
                            // precarga) y el onload de las fuentes, por su hash. Si cambian, hay que
                            // actualizar los hashes (lo comprueba cspHashes.test.ts en el frontend).
                            "script-src 'self' " + INDEX_SPECULATION_RULES_HASH + " 'unsafe-hashes' "
                            + INDEX_FONT_ONLOAD_HASH + " https://accounts.google.com https://apis.google.com"
                            // Google Analytics: solo se carga si el visitante acepta la analítica.
                            + " https://www.googletagmanager.com; " +
                            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
                            "font-src 'self' https://fonts.gstatic.com; " +
                            // blob: para la vista previa local de una foto antes de subirla.
                            "img-src 'self' data: blob: https:; " +
                            // 'self' ya incluye el WebSocket del mismo origen (ws/wss).
                            "connect-src 'self' https://accounts.google.com https://site.api.espn.com https://a.espncdn.com"
                            + " https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com; " +
                            "frame-src 'self' https://accounts.google.com; " +
                            "frame-ancestors 'none';")
                )
                .permissionsPolicyHeader(perm -> perm
                    .policy("camera=(), microphone=(), geolocation=()")
                )
            )
            .addFilterBefore(rateLimitingFilter, UsernamePasswordAuthenticationFilter.class)
            .addFilterBefore(csrfOriginFilter, UsernamePasswordAuthenticationFilter.class)
            .addFilterBefore(metricsTokenFilter, UsernamePasswordAuthenticationFilter.class)
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
