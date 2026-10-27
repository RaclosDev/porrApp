package com.porra.mundial.config;

import com.porra.mundial.controller.AppWebSocketHandler;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

/**
 * Configuración central del protocolo WebSocket.
 * Abre un canal de comunicación en tiempo real bidireccional entre el cliente (React) y el servidor (Spring).
 * Protegido contra Cross-Site WebSocket Hijacking (CSWSH) mediante validación de orígenes autorizados.
 */
@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final AppWebSocketHandler appWebSocketHandler;

    @Value("${app.cors.allowed-origins:*}")
    private String allowedOrigins;

    public WebSocketConfig(AppWebSocketHandler appWebSocketHandler) {
        this.appWebSocketHandler = appWebSocketHandler;
    }

    /**
     * Registra el manejador de mensajes de WebSocket en un endpoint específico.
     * 
     * @param registry El registro interno de Spring WebSocket.
     */
    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        String[] origins = (allowedOrigins != null && !allowedOrigins.isBlank())
                ? allowedOrigins.split(",")
                : new String[]{"*"};

        registry.addHandler(appWebSocketHandler, "/api/ws")
                .setAllowedOriginPatterns(origins);
    }
}
