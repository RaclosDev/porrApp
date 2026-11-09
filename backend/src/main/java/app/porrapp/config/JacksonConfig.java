package app.porrapp.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import tools.jackson.core.JsonGenerator;
import tools.jackson.databind.JacksonModule;
import tools.jackson.databind.SerializationContext;
import tools.jackson.databind.ValueSerializer;
import tools.jackson.databind.module.SimpleModule;

import app.porrapp.dto.MadridDateTimeSerializer;
import app.porrapp.util.AppTime;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * Las fechas se guardan como instantes. En la API salen con el desfase de Madrid
 * ({@code 2026-06-11T21:00:00+02:00}) para que el navegador no las lea como hora local: sin él, en
 * Canarias o fuera de España las horas de los partidos y de los cierres se ven desplazadas.
 */
@Configuration
public class JacksonConfig {

    @Bean
    public JacksonModule madridOffsetDatesModule() {
        return madridOffsetDates();
    }

    static JacksonModule madridOffsetDates() {
        SimpleModule module = new SimpleModule("MadridOffsetDates");
        module.addSerializer(LocalDateTime.class, new ValueSerializer<LocalDateTime>() {
            @Override
            public void serialize(LocalDateTime value, JsonGenerator gen, SerializationContext ctxt) {
                gen.writeString(value.atZone(AppTime.ZONE).format(DateTimeFormatter.ISO_OFFSET_DATE_TIME));
            }
        });
        module.addSerializer(Instant.class, new MadridDateTimeSerializer());
        return module;
    }
}
