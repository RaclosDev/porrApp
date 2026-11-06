package com.porra.mundial.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import tools.jackson.core.JsonGenerator;
import tools.jackson.databind.JacksonModule;
import tools.jackson.databind.SerializationContext;
import tools.jackson.databind.ValueSerializer;
import tools.jackson.databind.module.SimpleModule;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

/**
 * Las fechas se guardan como {@link LocalDateTime} en hora peninsular. En la API salen con su desfase
 * ({@code 2026-06-11T21:00:00+02:00}) para que el navegador no las lea como hora local: sin él, en
 * Canarias o fuera de España las horas de los partidos y de los cierres se ven desplazadas.
 */
@Configuration
public class JacksonConfig {

    static final ZoneId APP_ZONE = ZoneId.of("Europe/Madrid");

    @Bean
    public JacksonModule madridOffsetDatesModule() {
        return madridOffsetDates();
    }

    static JacksonModule madridOffsetDates() {
        SimpleModule module = new SimpleModule("MadridOffsetDates");
        module.addSerializer(LocalDateTime.class, new ValueSerializer<LocalDateTime>() {
            @Override
            public void serialize(LocalDateTime value, JsonGenerator gen, SerializationContext ctxt) {
                gen.writeString(value.atZone(APP_ZONE).format(DateTimeFormatter.ISO_OFFSET_DATE_TIME));
            }
        });
        return module;
    }
}
