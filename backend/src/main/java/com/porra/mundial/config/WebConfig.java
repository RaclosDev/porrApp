package com.porra.mundial.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.web.filter.ShallowEtagHeaderFilter;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.resource.PathResourceResolver;

import java.io.IOException;
import java.util.Arrays;
import java.util.concurrent.TimeUnit;

/**
 * Configuración web de Spring MVC:
 * - CORS granular para la API REST y las vistas/imágenes públicas de invitación.
 * - Enrutamiento y fallback SPA para React.
 * - Cacheo HTTP inmutable de 1 año para assets estáticos hashed (/assets/**) y noCache para entrypoints dinámicos.
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Value("${app.cors.allowed-origins:https://porrapp.app,http://localhost:5173,http://localhost:8080}")
    private String allowedOrigins;

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        String[] origins = Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toArray(String[]::new);

        registry.addMapping("/api/**")
                .allowedOriginPatterns(origins)
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .maxAge(3600);

        // La imagen Open Graph también se descarga desde el navegador para adjuntarla
        // como archivo en WhatsApp. Permitir GET desde los orígenes configurados.
        registry.addMapping("/join/**")
                .allowedOriginPatterns(origins)
                .allowedMethods("GET", "OPTIONS")
                .allowedHeaders("*")
                .maxAge(3600);
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // Bundles JS/CSS con hash inmutable generados por Vite: Cache por 1 año inmutable
        registry.addResourceHandler("/assets/**")
                .addResourceLocations("classpath:/static/assets/")
                .setCacheControl(CacheControl.maxAge(365, TimeUnit.DAYS).cachePublic().immutable());

        // Archivos dinámicos que no deben cachearse en cliente. Sin Last-Modified: dentro del
        // jar todos los archivos tienen la fecha fija de 1980, así que la revalidación con
        // If-Modified-Since respondía 304 tras cada despliegue y el navegador conservaba el
        // sw.js antiguo (el Service Worker nunca detectaba la versión nueva).
        registry.addResourceHandler("/index.html", "/sw.js", "/workbox-*.js")
                .addResourceLocations("classpath:/static/")
                .setCacheControl(CacheControl.noCache())
                .setUseLastModified(false);

        // SPA Fallback
        registry.addResourceHandler("/**")
                .addResourceLocations("classpath:/static/")
                .setCacheControl(CacheControl.noCache())
                .setUseLastModified(false)
                .resourceChain(true)
                .addResolver(new PathResourceResolver() {
                    @Override
                    protected Resource getResource(String resourcePath, Resource location) throws IOException {
                        Resource requestedResource = location.createRelative(resourcePath);
                        if (requestedResource.exists() && requestedResource.isReadable()) {
                            return requestedResource;
                        }

                        if (resourcePath.startsWith("api") || resourcePath.startsWith("/api")) {
                            return null;
                        }

                        return location.createRelative("index.html");
                    }
                });
    }

    /**
     * ETag de la clasificación: si el cuerpo no ha cambiado se responde 304 sin reenviarlo, lo que
     * ahorra datos cuando muchas pantallas la piden a la vez tras cada aviso.
     */
    @Bean
    public FilterRegistrationBean<ShallowEtagHeaderFilter> leaderboardEtagFilter() {
        FilterRegistrationBean<ShallowEtagHeaderFilter> registration =
                new FilterRegistrationBean<>(new ShallowEtagHeaderFilter());
        registration.addUrlPatterns("/api/leaderboard", "/api/leaderboard/*");
        registration.setName("leaderboardEtagFilter");
        return registration;
    }
}
