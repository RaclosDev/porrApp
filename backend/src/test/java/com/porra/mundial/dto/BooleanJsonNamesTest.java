package com.porra.mundial.dto;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Lombok genera {@code isX()} para los campos {@code boolean isX} y Jackson los publicaría como "x".
 * El frontend lee los nombres con prefijo, así que tienen que llegar tal cual.
 */
class BooleanJsonNamesTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    @DisplayName("GroupMemberDTO publica isAdmin")
    void groupMemberExposesIsAdmin() {
        JsonNode json = mapper.valueToTree(GroupMemberDTO.builder().userId(1L).admin(true).build());
        assertTrue(json.path("isAdmin").asBoolean(), json.toString());
        assertFalse(json.has("admin"), json.toString());
    }

    @Test
    @DisplayName("MatchdayFriendPredictionDTO publica isCaller y hasPredicted")
    void friendPredictionExposesIsCaller() {
        JsonNode json = mapper.valueToTree(MatchdayFriendPredictionDTO.builder().userId(1L).caller(true).hasPredicted(true).build());
        assertTrue(json.path("isCaller").asBoolean(), json.toString());
        assertTrue(json.path("hasPredicted").asBoolean(), json.toString());
        assertFalse(json.has("caller"), json.toString());
    }
}
