package com.porra.mundial.config;

import com.porra.mundial.controller.AppWebSocketHandler;
import com.porra.mundial.service.notification.WebSocketService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.util.Map;

/** Endpoint /api/ws; solo acepta orígenes permitidos (evita CSWSH). */
@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final AppWebSocketHandler appWebSocketHandler;
    private final RateLimitingFilter rateLimitingFilter;

    @Value("${app.cors.allowed-origins:https://porra.raclos.es,http://localhost:5173,http://localhost:8080}")
    private String allowedOrigins;

    public WebSocketConfig(AppWebSocketHandler appWebSocketHandler, RateLimitingFilter rateLimitingFilter) {
        this.appWebSocketHandler = appWebSocketHandler;
        this.rateLimitingFilter = rateLimitingFilter;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        String[] origins = java.util.Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(origin -> !origin.isEmpty())
                .toArray(String[]::new);

        registry.addHandler(appWebSocketHandler, "/api/ws")
                .setAllowedOriginPatterns(origins)
                .addInterceptors(new ClientIpInterceptor());
    }

    /** Guarda la IP real del cliente (la misma que usa el rate limit) para el tope de conexiones por IP. */
    private class ClientIpInterceptor implements HandshakeInterceptor {
        @Override
        public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                       WebSocketHandler wsHandler, Map<String, Object> attributes) {
            if (request instanceof ServletServerHttpRequest servlet) {
                attributes.put(WebSocketService.CLIENT_IP_ATTRIBUTE,
                        rateLimitingFilter.getClientIp(servlet.getServletRequest()));
            }
            return true;
        }

        @Override
        public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                   WebSocketHandler wsHandler, Exception exception) {
            // Nada que hacer.
        }
    }
}
