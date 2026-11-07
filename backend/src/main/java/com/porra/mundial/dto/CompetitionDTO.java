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
 * @param finished   ya se han jugado todos sus partidos importados: no queda nada que pronosticar
 * @param groupStage si tiene fase de grupos; null mientras no haya partidos importados
 */
public record CompetitionDTO(Long id, String name, String externalId, String formatType, Sport sport,
                             boolean finished, Boolean groupStage) {

    /** Partidos importados de una competición: todos, los que faltan por terminar y los de grupos. */
    public record CalendarStats(long matches, long unfinished, long groupMatches) {
        public static final CalendarStats NONE = new CalendarStats(0, 0, 0);
    }

    public static CompetitionDTO of(Competition competition, CalendarStats stats) {
        CalendarStats calendar = stats == null ? CalendarStats.NONE : stats;
        boolean imported = calendar.matches() > 0;
        return new CompetitionDTO(competition.getId(), competition.getName(),
                competition.getExternalId(), competition.getFormatType(),
                Sport.ofExternalId(competition.getExternalId()),
                imported && calendar.unfinished() == 0,
                imported ? calendar.groupMatches() > 0 : null);
    }
}
