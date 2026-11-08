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

        SportsDataProvider resolved = registry.findProviderForCompetition("fifa-world-cup").orElseThrow();

        assertSame(espnProvider, resolved);
    }

    @Test
    @DisplayName("Si ningún proveedor la reconoce, no se elige el primero")
    void noProviderForUnknownCompetitions() {
        when(espnProvider.supports("bingo")).thenReturn(false);
        when(domesticLeagueProvider.supports("bingo")).thenReturn(false);

        assertTrue(registry.findProviderForCompetition("bingo").isEmpty());
    }

    @Test
    @DisplayName("Debe resolver el proveedor que soporte la liga doméstica")
    void resolvesProviderForDomesticLeagues() {
        when(espnProvider.supports("laliga-2026")).thenReturn(false);
        when(domesticLeagueProvider.supports("laliga-2026")).thenReturn(true);

        SportsDataProvider resolved = registry.findProviderForCompetition("laliga-2026").orElseThrow();

        assertSame(domesticLeagueProvider, resolved);
    }
}
