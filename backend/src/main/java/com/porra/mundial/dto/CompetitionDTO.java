package com.porra.mundial.dto;

import com.porra.mundial.model.Competition;

/**
 * Competición en la que se puede crear una liga.
 *
 * @param id         id interno
 * @param name       nombre visible
 * @param externalId id en el proveedor deportivo (ej. "esp.1", "fifa.world")
 * @param formatType "LEAGUE" o "TOURNAMENT"
 */
public record CompetitionDTO(Long id, String name, String externalId, String formatType) {

    public static CompetitionDTO of(Competition competition) {
        return new CompetitionDTO(competition.getId(), competition.getName(),
                competition.getExternalId(), competition.getFormatType());
    }
}
