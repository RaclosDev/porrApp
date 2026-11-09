package app.porrapp.dto;

import app.porrapp.util.AppTime;
import tools.jackson.core.JsonGenerator;
import tools.jackson.databind.SerializationContext;
import tools.jackson.databind.ValueSerializer;

import java.time.Instant;


/** Instantes con el desfase de Madrid, el mismo formato que el resto de la API. */
public final class MadridDateTimeSerializer extends ValueSerializer<Instant> {

    public static String format(Instant value) {
        return AppTime.format(value);
    }

    @Override
    public void serialize(Instant value, JsonGenerator generator, SerializationContext context) {
        generator.writeString(format(value));
    }
}
