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
    @DisplayName("La liga dice las rondas de su torneo con grupos: el Mundial desde dieciseisavos, la Eurocopa desde octavos")
    void tellsTheRoundsOfItsGroupTournament() {
        TournamentRoundsDTO worldCup = new TournamentRoundsDTO("r32", true);
        assertEquals(worldCup, LeagueResponseDTO.of(league, edition, true).getTournamentRounds());
        assertEquals(worldCup, LeagueResponseDTO.preview(league, edition).getTournamentRounds());
        assertEquals(worldCup, LeagueScoringDTO.of(edition, false).tournamentRounds());

        Edition euroEdition = Edition.builder().id(6L).league(league).poolFormat(PoolFormat.FULL_BRACKET)
                .status("ACTIVE")
                .competition(Competition.builder().id(2L).name("Eurocopa 2024").formatType("TOURNAMENT")
                        .externalId("uefa.euro").build())
                .build();
        TournamentRoundsDTO euro = new TournamentRoundsDTO("r16", false);
        assertEquals(euro, LeagueResponseDTO.of(league, euroEdition, true).getTournamentRounds());
        assertEquals(euro, LeagueScoringDTO.of(euroEdition, true).tournamentRounds());
        assertEquals(euro, CompetitionDTO.of(euroEdition.getCompetition(), null).tournamentRounds());

        // Una liga o un torneo sin grupos que predecir no tiene rondas que nombrar.
        Edition matchdays = Edition.builder().id(7L).league(league).poolFormat(PoolFormat.MATCH_DAY)
                .status("ACTIVE")
                .competition(Competition.builder().id(3L).name("LaLiga").formatType("LEAGUE")
                        .externalId("esp.1").build())
                .build();
        assertNull(LeagueResponseDTO.of(league, matchdays, true).getTournamentRounds());
        assertNull(LeagueScoringDTO.of(matchdays, false).tournamentRounds());
        assertNull(LeagueResponseDTO.of(league, null, true).getTournamentRounds());
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
