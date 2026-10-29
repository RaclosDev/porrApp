package com.porra.mundial.sports;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SportsDataProviderRegistryTest {

    @Mock
    private SportsDataProvider espnProvider;

    @Mock
    private SportsDataProvider domesticLeagueProvider;

    private SportsDataProviderRegistry registry;

    @BeforeEach
    void setUp() {
        registry = new SportsDataProviderRegistry(List.of(espnProvider, domesticLeagueProvider));
    }

    @Test
    @DisplayName("Debe resolver ESPN para competiciones mundiales o FIFA")
    void resolvesEspnForWorldCup() {
        when(espnProvider.supports("fifa-world-cup")).thenReturn(true);

        SportsDataProvider resolved = registry.getProviderForCompetition("fifa-world-cup");

        assertSame(espnProvider, resolved);
    }

    @Test
    @DisplayName("Debe resolver el proveedor que soporte la liga doméstica")
    void resolvesProviderForDomesticLeagues() {
        when(espnProvider.supports("laliga-2026")).thenReturn(false);
        when(domesticLeagueProvider.supports("laliga-2026")).thenReturn(true);

        SportsDataProvider resolved = registry.getProviderForCompetition("laliga-2026");

        assertSame(domesticLeagueProvider, resolved);
    }

    @Test
    @DisplayName("Debe listar todos los proveedores registrados")
    void listsAllProviders() {
        assertEquals(2, registry.getAllProviders().size());
    }
}
