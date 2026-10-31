package com.porra.mundial.config;

import com.porra.mundial.controller.AppWebSocketHandler;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

/** Endpoint /api/ws; solo acepta orígenes permitidos (evita CSWSH). */
@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final AppWebSocketHandler appWebSocketHandler;

    @Value("${app.cors.allowed-origins:https://porra.raclos.es,http://localhost:5173,http://localhost:8080}")
    private String allowedOrigins;

    public WebSocketConfig(AppWebSocketHandler appWebSocketHandler) {
        this.appWebSocketHandler = appWebSocketHandler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        String[] origins = java.util.Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(origin -> !origin.isEmpty())
                .toArray(String[]::new);

        registry.addHandler(appWebSocketHandler, "/api/ws")
                .setAllowedOriginPatterns(origins);
    }
}
