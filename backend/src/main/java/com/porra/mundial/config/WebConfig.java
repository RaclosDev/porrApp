package com.porra.mundial.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.resource.PathResourceResolver;
import java.io.IOException;

/**
 * Configuración de Spring Web MVC.
 * Gestiona el enrutamiento de estáticos (React Frontend) y la política de CORS.
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    /**
     * Configuración global de CORS (Cross-Origin Resource Sharing).
     * Permite que el frontend (React) haga llamadas a nuestra API REST 
     * incluso si se estuviera sirviendo en un puerto o dominio distinto durante el desarrollo.
     */
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins("*") // En producción estricta esto debería apuntar solo a nuestro dominio
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*");
    }

    /**
     * Mapeador de recursos estáticos.
     * Es CRÍTICO para que una aplicación Single Page Application (SPA) como React funcione
     * incrustada dentro de Spring Boot. Si el usuario recarga la página en /bracket, Spring Boot 
     * no encontrará ese Endpoint y devolvería 404, por lo que aquí le decimos que cualquier ruta
     * que no sea /api/* devuelva el index.html de React.
     */
    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // Evita el cacheo agresivo del index.html y los Service Workers para que las nuevas builds se carguen inmediatamente
        registry.addResourceHandler("/index.html", "/sw.js", "/workbox-*.js")
                .addResourceLocations("classpath:/static/")
                .setCacheControl(org.springframework.http.CacheControl.noCache());

        // Manejo dinámico de rutas del frontend SPA (Fallback a index.html)
        registry.addResourceHandler("/**")
                .addResourceLocations("classpath:/static/")
                .setCacheControl(org.springframework.http.CacheControl.noCache())
                .resourceChain(true)
                .addResolver(new PathResourceResolver() {
                    @Override
                    protected Resource getResource(String resourcePath, Resource location) throws IOException {
                        // Intenta cargar el recurso solicitado de forma normal (ej: un .css, .jpg)
                        Resource requestedResource = location.createRelative(resourcePath);
                        if (requestedResource.exists() && requestedResource.isReadable()) {
                            return requestedResource;
                        }
                        
                        // Si la ruta pertenece a la API, no devolvemos el HTML de React, devolvemos NULL (Dará 404 de Spring)
                        if (resourcePath.startsWith("api/")) {
                            return null;
                        }
                        
                        // Fallback de seguridad si un JS empaquetado no se encuentra (borrado o renombrado)
                        if (resourcePath.startsWith("assets/") && resourcePath.endsWith(".js")) {
                            return new ClassPathResource("/static/recovery.js");
                        }
                        
                        // Si es una ruta de navegación de React (ej: /standings), servimos index.html
                        // y dejamos que React Router se encargue de mostrar la vista correcta en el navegador.
                        return new ClassPathResource("/static/index.html");
                    }
                });
    }
}
