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
    private SportsDataProvider apiFootballProvider;

    private SportsDataProviderRegistry registry;

    @BeforeEach
    void setUp() {
        registry = new SportsDataProviderRegistry(List.of(espnProvider, apiFootballProvider));
    }

    @Test
    @DisplayName("Debe resolver ESPN para competiciones mundiales o FIFA")
    void resolvesEspnForWorldCup() {
        when(espnProvider.supports("fifa-world-cup")).thenReturn(true);

        SportsDataProvider resolved = registry.getProviderForCompetition("fifa-world-cup");

        assertSame(espnProvider, resolved);
    }

    @Test
    @DisplayName("Debe resolver API-Football para competiciones de liga doméstica")
    void resolvesApiFootballForDomesticLeagues() {
        when(espnProvider.supports("laliga-2026")).thenReturn(false);
        when(apiFootballProvider.supports("laliga-2026")).thenReturn(true);

        SportsDataProvider resolved = registry.getProviderForCompetition("laliga-2026");

        assertSame(apiFootballProvider, resolved);
    }

    @Test
    @DisplayName("Debe listar todos los proveedores registrados")
    void listsAllProviders() {
        assertEquals(2, registry.getAllProviders().size());
    }
}
