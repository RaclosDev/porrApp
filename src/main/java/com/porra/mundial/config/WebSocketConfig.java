package com.porra.mundial.config;

import com.porra.mundial.controller.AppWebSocketHandler;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

/**
 * Configuración central del protocolo WebSocket.
 * Abre un canal de comunicación en tiempo real bidireccional entre el cliente (React) y el servidor (Spring).
 */
@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final AppWebSocketHandler appWebSocketHandler;

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
        // Mapea la URL /api/ws al manejador y permite conexiones desde cualquier origen (CORS bypass).
        registry.addHandler(appWebSocketHandler, "/api/ws")
                .setAllowedOrigins("*");
    }
}
