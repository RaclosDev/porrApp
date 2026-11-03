package com.porra.mundial.model;

import com.porra.mundial.dto.PredictionDataDTO;
import jakarta.persistence.PersistenceException;
import org.junit.jupiter.api.Test;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class PredictionDataConverterTest {

    @Test
    void wrapsSerializationFailureAsPersistenceErrorWithoutExposingItsDetails() throws Exception {
        ObjectMapper mapper = mock(ObjectMapper.class);
        JacksonException technicalFailure = mock(JacksonException.class);
        when(mapper.writeValueAsString(any(PredictionDataDTO.class))).thenThrow(technicalFailure);
        PredictionDataConverter converter = new PredictionDataConverter(mapper);

        PersistenceException error = assertThrows(PersistenceException.class,
                () -> converter.convertToDatabaseColumn(new PredictionDataDTO()));

        assertEquals("Error interno al persistir el pronóstico", error.getMessage());
        assertSame(technicalFailure, error.getCause());
    }
}
