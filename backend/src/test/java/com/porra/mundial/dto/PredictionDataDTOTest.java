package com.porra.mundial.dto;

import tools.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

public class PredictionDataDTOTest {
    @Test
    void preservesExplicitVersionAndDoesNotUpgradeHistoricalJson() {
        ObjectMapper mapper = new ObjectMapper();
        PredictionDataDTO legacy = mapper.readValue("{}", PredictionDataDTO.class);
        assertEquals(null, legacy.getTopologyVersion());
        PredictionDataDTO canonical = mapper.readValue("{\"topologyVersion\":2}", PredictionDataDTO.class);
        assertEquals(2, canonical.getTopologyVersion());
        assertEquals(2, mapper.readValue(mapper.writeValueAsString(canonical), PredictionDataDTO.class).getTopologyVersion());
        assertEquals(null, mapper.readValue(mapper.writeValueAsString(legacy), PredictionDataDTO.class).getTopologyVersion());
    }
    @Test
    void testSerialization() throws Exception {
        PredictionDataDTO dto = new PredictionDataDTO();
        dto.setFinalMatch(List.of("España", "Brasil"));
        ObjectMapper mapper = new ObjectMapper();
        String json = mapper.writeValueAsString(dto);
        assertTrue(json.contains("\"final\":["));
    }

    @Test
    void testDeserializationWithFinal() throws Exception {
        String json = "{\"final\":[\"España\",\"Brasil\"],\"champion\":\"España\"}";
        ObjectMapper mapper = new ObjectMapper();
        PredictionDataDTO dto = mapper.readValue(json, PredictionDataDTO.class);
        assertNotNull(dto.getFinalMatch());
        assertTrue(dto.getFinalMatch().contains("España"));
    }

    @Test
    void testDeserializationWithFinalMatch() throws Exception {
        String json = "{\"finalMatch\":[\"España\",\"Brasil\"],\"champion\":\"España\"}";
        ObjectMapper mapper = new ObjectMapper();
        PredictionDataDTO dto = mapper.readValue(json, PredictionDataDTO.class);
        assertEquals(List.of("España", "Brasil"), dto.getFinalMatch());
        assertEquals("España", dto.getChampion());
        assertEquals(dto.getFinalMatch(), mapper.readValue(mapper.writeValueAsString(dto), PredictionDataDTO.class).getFinalMatch());
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
