package app.porrapp.dto;

import app.porrapp.model.Competition;
import app.porrapp.model.Edition;
import app.porrapp.model.League;
import app.porrapp.model.PoolFormat;
import app.porrapp.model.UserAccount;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class LeagueResponseDTOTest {

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
            .competition(Competition.builder().id(1L).name("Mundial 2026").formatType("TOURNAMENT")
                    .externalId(Competition.WORLD_CUP_EXTERNAL_ID).build())
            .poolFormat(PoolFormat.KNOCKOUTS_ONLY)
            .status("ACTIVE")
            .pichichi(true)
            .build();

    @Test
    @DisplayName("Los miembros ven el código de invitación; el resto no")
    void joinCodeOnlyForMembers() {
        assertEquals("WC2026", LeagueResponseDTO.of(league, edition, true).getJoinCode());
        assertNull(LeagueResponseDTO.of(league, edition, false).getJoinCode());
    }

    @Test
    @DisplayName("Incluye los datos de la edición activa")
    void includesActiveEdition() {
        LeagueResponseDTO dto = LeagueResponseDTO.of(league, edition, true);

        assertEquals("KNOCKOUTS_ONLY", dto.getPoolFormat());
        assertEquals("Mundial 2026", dto.getCompetitionName());
        assertEquals("TOURNAMENT", dto.getFormatType());
        assertTrue(dto.getPichichi());
        assertEquals("Admin", dto.getAdminParticipantName());
        // Fuera del cuadro del Mundial no hay pichichi, aunque la edición lo tenga marcado.
        edition.setPoolFormat(PoolFormat.MATCH_DAY);
        assertFalse(LeagueResponseDTO.of(league, edition, true).getPichichi());
        edition.setPoolFormat(PoolFormat.KNOCKOUTS_ONLY);
        assertEquals("Sin rencores", dto.getRules());
    }

    @Test
    @DisplayName("Sin edición activa la liga figura como abierta y sin competición")
    void withoutEdition() {
        LeagueResponseDTO dto = LeagueResponseDTO.of(league, null, true);

        assertFalse(dto.getIsLocked());
        assertNull(dto.getPoolFormat());
        assertNull(dto.getCompetitionId());
    }

    @Test
    @DisplayName("La previsualización de invitación no expone administrador, reglas ni código")
    void previewHidesPrivateFields() {
        LeagueResponseDTO dto = LeagueResponseDTO.preview(league, edition);

        assertEquals("Liga Mundial", dto.getName());
        assertEquals("KNOCKOUTS_ONLY", dto.getPoolFormat());
        assertNull(dto.getJoinCode());
        assertNull(dto.getAdminParticipantName());
        assertNull(dto.getRules());
    }
}
