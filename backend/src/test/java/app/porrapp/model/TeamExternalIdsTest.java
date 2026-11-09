package app.porrapp.model;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class TeamExternalIdsTest {

    private static Competition competition(String externalId) {
        return Competition.builder().externalId(externalId).build();
    }

    @Test
    @DisplayName("El id numérico del fútbol lleva el prefijo de su deporte")
    void aFootballIdGetsItsSportPrefix() {
        assertEquals("soccer-364", TeamExternalIds.of(competition("eng.1"), "364"));
        assertEquals("soccer-164", TeamExternalIds.of(competition("fifa.world"), " 164 "));
        assertEquals("soccer-164", TeamExternalIds.of(null, "164"));
    }

    @Test
    @DisplayName("Los ids que ya traen el prefijo de su deporte se quedan como están")
    void anIdThatAlreadyCarriesItsSportIsLeftAlone() {
        assertEquals("nba-13", TeamExternalIds.of(competition("nba"), "nba-13"));
        assertEquals("nfl:33", TeamExternalIds.of(competition("nfl"), "nfl:33"));
        assertEquals("soccer-364", TeamExternalIds.of(competition("eng.1"), "soccer-364"));
    }

    @Test
    @DisplayName("Sin id del proveedor no hay id externo")
    void noProviderIdMeansNoExternalId() {
        assertNull(TeamExternalIds.of(competition("eng.1"), null));
        assertNull(TeamExternalIds.of(competition("eng.1"), "  "));
    }

    @Test
    @DisplayName("El id antiguo de un equipo de fútbol es su número a secas")
    void theLegacyIdOfAFootballTeamIsItsBareNumber() {
        assertEquals("364", TeamExternalIds.legacy("soccer-364"));
        assertNull(TeamExternalIds.legacy("nba-13"));
        assertNull(TeamExternalIds.legacy(null));
    }
}
