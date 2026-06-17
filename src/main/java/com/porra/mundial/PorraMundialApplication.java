package com.porra.mundial;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

import jakarta.annotation.PostConstruct;
import java.util.TimeZone;

@SpringBootApplication
@EnableScheduling
public class PorraMundialApplication {

    @PostConstruct
    public void init() {
        // Establecer la zona horaria de la JVM a España para que coincida con local y DB
        TimeZone.setDefault(TimeZone.getTimeZone("Europe/Madrid"));
    }

    public static void main(String[] args) {
        SpringApplication.run(PorraMundialApplication.class, args);
    }
}
