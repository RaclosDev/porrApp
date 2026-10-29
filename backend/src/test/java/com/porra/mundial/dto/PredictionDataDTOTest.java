package com.porra.mundial.dto;

import tools.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

public class PredictionDataDTOTest {
    @Test
    void testSerialization() throws Exception {
        PredictionDataDTO dto = new PredictionDataDTO();
        dto.setFinalMatch(List.of("España", "Brasil"));
        ObjectMapper mapper = new ObjectMapper();
        String json = mapper.writeValueAsString(dto);
        System.out.println("SERIALIZED_JSON: " + json);
        assertTrue(json.contains("\"final\":["));
    }

    @Test
    void testDeserializationWithFinal() throws Exception {
        String json = "{\"final\":[\"España\",\"Brasil\"],\"champion\":\"España\"}";
        ObjectMapper mapper = new ObjectMapper();
        PredictionDataDTO dto = mapper.readValue(json, PredictionDataDTO.class);
        System.out.println("DESERIALIZED_FINAL: " + dto.getFinalMatch());
        assertNotNull(dto.getFinalMatch());
        assertTrue(dto.getFinalMatch().contains("España"));
    }

    @Test
    void testDeserializationWithFinalMatch() throws Exception {
        String json = "{\"finalMatch\":[\"España\",\"Brasil\"],\"champion\":\"España\"}";
        ObjectMapper mapper = new ObjectMapper();
        PredictionDataDTO dto = mapper.readValue(json, PredictionDataDTO.class);
        System.out.println("DESERIALIZED_FINALMATCH: " + dto.getFinalMatch());
    }

    @Test
    void testDeserializationWithR1AndR32() throws Exception {
        String jsonR1 = "{\"r1\":[[\"España\",\"Brasil\"]],\"finalMatch\":[\"España\",\"Brasil\"]}";
        ObjectMapper mapper = new ObjectMapper();
        PredictionDataDTO dto1 = mapper.readValue(jsonR1, PredictionDataDTO.class);
        assertNotNull(dto1.getR32());
        assertTrue(dto1.getR32().get(0).contains("España"));

        String jsonR32 = "{\"r32\":[[\"Francia\",\"Alemania\"]],\"finalMatch\":[\"Francia\",\"Alemania\"]}";
        PredictionDataDTO dto2 = mapper.readValue(jsonR32, PredictionDataDTO.class);
        assertNotNull(dto2.getR32());
        assertTrue(dto2.getR32().get(0).contains("Francia"));
    }
}
