package com.porra.mundial.config;

import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Caché en memoria (clasificación, partidos, ligas), tareas programadas (sincronización con ESPN,
 * goleadores) y tareas asíncronas (importar el calendario de una liga recién creada).
 */
@Configuration
@EnableCaching
@EnableScheduling
@EnableAsync
public class ApplicationFeaturesConfig {
}
