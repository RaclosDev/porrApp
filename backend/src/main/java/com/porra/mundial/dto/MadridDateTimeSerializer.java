package com.porra.mundial.dto;

import tools.jackson.core.JsonGenerator;
import tools.jackson.databind.SerializationContext;
import tools.jackson.databind.ValueSerializer;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

/** Match dates are stored as Madrid wall time; API consumers need an explicit offset. */
public final class MadridDateTimeSerializer extends ValueSerializer<LocalDateTime> {
    public static final ZoneId ZONE = ZoneId.of("Europe/Madrid");

    public static String format(LocalDateTime value) {
        return value == null ? null : value.atZone(ZONE).format(DateTimeFormatter.ISO_OFFSET_DATE_TIME);
    }

    @Override
    public void serialize(LocalDateTime value, JsonGenerator generator, SerializationContext context) {
        generator.writeString(format(value));
    }
}
