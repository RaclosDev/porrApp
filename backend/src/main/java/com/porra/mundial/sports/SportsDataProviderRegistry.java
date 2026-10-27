package com.porra.mundial.sports;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Registro y despachador de proveedores de datos deportivos (Fase 4).
 * Permite resolver dinámicamente el adapter adecuado según la competición.
 */
@Component
@RequiredArgsConstructor
public class SportsDataProviderRegistry {

    private final List<SportsDataProvider> providers;

    public SportsDataProvider getProviderForCompetition(String competitionCode) {
        if (providers == null || providers.isEmpty()) {
            throw new IllegalStateException("No hay proveedores de datos deportivos registrados.");
        }

        return providers.stream()
                .filter(p -> p.supports(competitionCode))
                .findFirst()
                .orElse(providers.get(0));
    }

    public List<SportsDataProvider> getAllProviders() {
        return providers;
    }
}
