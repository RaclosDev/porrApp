package com.porra.mundial;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import jakarta.annotation.PostConstruct;
import java.util.TimeZone;

/**
 *  Clase principal (Entry Point) de la aplicación Spring Boot "Porra Mundial".
 * 
 * La caché, las tareas programadas y las asíncronas se activan en
 * {@link com.porra.mundial.config.ApplicationFeaturesConfig}, fuera de esta clase, para que los
 * tests de capa (@WebMvcTest, @DataJpaTest) no las arrastren.
 */
@SpringBootApplication
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
