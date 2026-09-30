package com.porra.mundial.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.net.http.HttpClient;
import java.time.Duration;

/**
 * Configuración general de Beans de aplicación.
 */
@Configuration
public class AppConfig {

    /**
     * Instancia global de HttpClient utilizada para realizar peticiones a APIs externas
     * (por ejemplo, a la API oculta de ESPN). Se configura con tiempos de espera
     * razonables y soporte para redirecciones para evitar cuelgues si la API externa falla.
     * 
     * @return Cliente HTTP asíncrono y síncrono.
     */
    @Bean
    public HttpClient httpClient() {
        return HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1)
                .followRedirects(HttpClient.Redirect.NORMAL)
                .connectTimeout(Duration.ofSeconds(10)) // Evita que la app se quede bloqueada esperando a ESPN
                .build();
    }
}
