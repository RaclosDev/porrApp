package com.porra.mundial;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import jakarta.annotation.PostConstruct;
import java.util.TimeZone;

/**
 * La caché, las tareas programadas y las asíncronas se activan en
 * {@link com.porra.mundial.config.ApplicationFeaturesConfig}, fuera de esta clase, para que los
 * tests de capa (@WebMvcTest, @DataJpaTest) no las arrastren.
 */
@SpringBootApplication
public class PorraMundialApplication {

    /** JVM en Europe/Madrid: las fechas de los partidos y los cron van en hora peninsular. */
    @PostConstruct
    public void init() {
        TimeZone.setDefault(TimeZone.getTimeZone("Europe/Madrid"));
    }

    public static void main(String[] args) {
        SpringApplication.run(PorraMundialApplication.class, args);
    }
}
