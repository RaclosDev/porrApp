package com.porra.mundial.dto;

import com.porra.mundial.model.Competition;
import com.porra.mundial.model.Sport;

/**
 * Competición en la que se puede crear una liga.
 *
 * @param id         id interno
 * @param name       nombre visible
 * @param externalId id en el proveedor deportivo (ej. "esp.1", "fifa.world")
 * @param formatType "LEAGUE" o "TOURNAMENT"
 * @param sport      deporte, para agruparlas al crear una liga
 */
public record CompetitionDTO(Long id, String name, String externalId, String formatType, Sport sport) {

    public static CompetitionDTO of(Competition competition) {
        return new CompetitionDTO(competition.getId(), competition.getName(),
                competition.getExternalId(), competition.getFormatType(),
                Sport.ofExternalId(competition.getExternalId()));
    }
}
