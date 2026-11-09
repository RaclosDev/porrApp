package app.porrapp.config;

import net.javacrumbs.shedlock.core.LockProvider;
import net.javacrumbs.shedlock.provider.jdbctemplate.JdbcTemplateLockProvider;
import net.javacrumbs.shedlock.spring.annotation.EnableSchedulerLock;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Caché en memoria (clasificación, partidos, ligas), tareas programadas (sincronización con ESPN,
 * goleadores) y tareas asíncronas (importar el calendario de una liga recién creada).
 * Cada tarea programada toma un bloqueo en la tabla {@code shedlock}: si hay dos instancias a la vez
 * (p. ej. durante un despliegue) solo una la ejecuta, y no se mandan recordatorios duplicados.
 */
@Configuration
@EnableCaching
@EnableScheduling
@EnableAsync
@EnableSchedulerLock(defaultLockAtMostFor = "PT30M")
public class ApplicationFeaturesConfig {

    @Bean
    public LockProvider lockProvider(JdbcTemplate jdbcTemplate) {
        return new JdbcTemplateLockProvider(JdbcTemplateLockProvider.Configuration.builder()
                .withJdbcTemplate(jdbcTemplate)
                .usingDbTime()
                .build());
    }
}
