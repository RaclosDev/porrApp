package com.porra.mundial;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.scheduling.annotation.EnableScheduling;

import jakarta.annotation.PostConstruct;
import java.util.TimeZone;

/**
 *  Clase principal (Entry Point) de la aplicación Spring Boot "Porra Mundial".
 * 
 * Anotaciones importantes:
 * - @SpringBootApplication: Autoconfiguración y escaneo de componentes.
 * - @EnableScheduling: Habilita los cron jobs (como el de SyncService y TopScorerService).
 * - @EnableCaching: Habilita la caché en memoria (Redis/ConcurrentMapCache) usada en LeaderboardService.
 */
@SpringBootApplication
@EnableScheduling
@EnableCaching
public class PorraMundialApplication {

    /**
     * Se ejecuta justo después de inicializar el contexto de Spring.
     * Ajusta la zona horaria del servidor (JVM) a "Europe/Madrid".
     * Esto es crucial para que las fechas de los partidos en la base de datos
     * y los CRON jobs tengan sentido local y concuerden con España.
     */
    @PostConstruct
    public void init() {
        TimeZone.setDefault(TimeZone.getTimeZone("Europe/Madrid"));
    }

    /**
     * Método Main, arranca el servidor embebido (Tomcat por defecto).
     */
    public static void main(String[] args) {
        SpringApplication.run(PorraMundialApplication.class, args);
    }
}
