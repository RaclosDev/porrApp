package com.porra.mundial.model;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.porra.mundial.dto.PredictionDataDTO;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Converter(autoApply = false)
public class PredictionDataConverter implements AttributeConverter<PredictionDataDTO, String> {

    private static final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public String convertToDatabaseColumn(PredictionDataDTO attribute) {
        if (attribute == null) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(attribute);
        } catch (JsonProcessingException e) {
            log.error("Error serializando PredictionDataDTO a JSON", e);
            throw new IllegalArgumentException("Error serializando predicción a JSON", e);
        }
    }

    @Override
    public PredictionDataDTO convertToEntityAttribute(String dbData) {
        if (dbData == null || dbData.isBlank()) {
            return null;
        }
        try {
            return objectMapper.readValue(dbData, PredictionDataDTO.class);
        } catch (Exception e) {
            log.error("Error deserializando JSON a PredictionDataDTO", e);
            return null;
        }
    }
}
