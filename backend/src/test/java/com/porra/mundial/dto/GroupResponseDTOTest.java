package com.porra.mundial.dto;

import com.porra.mundial.model.Competition;
import com.porra.mundial.model.Edition;
import com.porra.mundial.model.League;
import com.porra.mundial.model.PoolFormat;
import com.porra.mundial.model.UserAccount;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class GroupResponseDTOTest {

    private final League league = League.builder()
            .id(20L)
            .name("Liga Mundial")
            .joinCode("WC2026")
            .rules("Sin rencores")
            .adminUser(UserAccount.builder().id(1L).participantName("Admin").build())
            .build();

    private final Edition edition = Edition.builder()
            .id(5L)
            .league(league)
            .competition(Competition.builder().id(1L).name("Mundial 2026").formatType("TOURNAMENT").build())
            .poolFormat(PoolFormat.KNOCKOUTS_ONLY)
            .status("ACTIVE")
            .pichichi(true)
            .build();

    @Test
    @DisplayName("Los miembros ven el código de invitación; el resto no")
    void joinCodeOnlyForMembers() {
        assertEquals("WC2026", GroupResponseDTO.of(league, edition, true).getJoinCode());
        assertNull(GroupResponseDTO.of(league, edition, false).getJoinCode());
    }

    @Test
    @DisplayName("Incluye los datos de la edición activa")
    void includesActiveEdition() {
        GroupResponseDTO dto = GroupResponseDTO.of(league, edition, true);

        assertEquals("KNOCKOUTS_ONLY", dto.getPoolFormat());
        assertEquals("Mundial 2026", dto.getCompetitionName());
        assertEquals("TOURNAMENT", dto.getFormatType());
        assertTrue(dto.getPichichi());
        assertEquals("Admin", dto.getAdminParticipantName());
        assertEquals("Sin rencores", dto.getRules());
    }

    @Test
    @DisplayName("Sin edición activa la liga figura como abierta y sin competición")
    void withoutEdition() {
        GroupResponseDTO dto = GroupResponseDTO.of(league, null, true);

        assertFalse(dto.getIsLocked());
        assertNull(dto.getPoolFormat());
        assertNull(dto.getCompetitionId());
    }

    @Test
    @DisplayName("La previsualización de invitación no expone administrador, reglas ni código")
    void previewHidesPrivateFields() {
        GroupResponseDTO dto = GroupResponseDTO.preview(league, edition);

        assertEquals("Liga Mundial", dto.getName());
        assertEquals("KNOCKOUTS_ONLY", dto.getPoolFormat());
        assertNull(dto.getJoinCode());
        assertNull(dto.getAdminParticipantName());
        assertNull(dto.getRules());
    }
}
