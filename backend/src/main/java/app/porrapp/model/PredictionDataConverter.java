package app.porrapp.model;

import app.porrapp.dto.PredictionDataDTO;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import jakarta.persistence.PersistenceException;
import lombok.extern.slf4j.Slf4j;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

@Slf4j
@Converter(autoApply = false)
public class PredictionDataConverter implements AttributeConverter<PredictionDataDTO, String> {

    private final ObjectMapper objectMapper;

    public PredictionDataConverter() {
        this(new ObjectMapper());
    }

    PredictionDataConverter(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public String convertToDatabaseColumn(PredictionDataDTO attribute) {
        if (attribute == null) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(attribute);
        } catch (JacksonException e) {
            throw new PersistenceException("Error interno al guardar la predicción", e);
        }
    }

    @Override
    public PredictionDataDTO convertToEntityAttribute(String dbData) {
        if (dbData == null || dbData.isBlank()) {
            return null;
        }
        try {
            String sanitized = app.porrapp.util.TextSanitizer.fixBracketDataJson(dbData);
            return objectMapper.readValue(sanitized, PredictionDataDTO.class);
        } catch (JacksonException e) {
            log.error("Error deserializando JSON a PredictionDataDTO", e);
            return null;
        }
    }
}
