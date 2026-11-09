package app.porrapp.config;

import app.porrapp.service.notification.WebSocketService;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.binder.MeterBinder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Métricas propias además de las de Spring Boot (peticiones HTTP, pool de Hikari, JVM y duración de las
 * tareas programadas como la sincronización, en {@code tasks.scheduled.execution}).
 */
@Configuration
public class MetricsConfig {

    @Bean
    public MeterBinder webSocketSessionsMetric(WebSocketService webSocketService) {
        return registry -> Gauge.builder("porra.websocket.sessions", webSocketService, WebSocketService::sessionCount)
                .description("Conexiones WebSocket abiertas")
                .register(registry);
    }
}
