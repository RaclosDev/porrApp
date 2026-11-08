package com.porra.mundial.dto;

import com.porra.mundial.model.CardSegment;
import com.porra.mundial.model.EventSeries;
import com.porra.mundial.model.MatchSelectionMode;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * Partidos que entran en una liga por jornadas: todos ({@code ALL}) o los de los equipos seguidos más
 * los añadidos y menos los quitados a mano ({@code CUSTOM}).
 *
 * @param competitionIds competiciones oficiales de las que la liga toma partidos, con la suya; con más
 *                       de una, la liga junta partidos sueltos de todas (solo con {@code CUSTOM}). Nulo
 *                       o vacío: las que ya tenía
 * @param eventSeries    UFC con {@code ALL}: solo las veladas numeradas o solo las Fight Night. Nulo: la
 *                       que ya tenía (al crear la liga, todas)
 * @param cardSegments   UFC: partes de la cartelera de cada velada que entran (estelar, preliminares,
 *                       preliminares tempranas). Nulo: las que ya tenía (al crear la liga, la velada
 *                       completa); vacío no vale
 */
public record MatchSelectionRequest(
        @NotNull(message = "Elige qué partidos entran en la liga") MatchSelectionMode mode,
        @Size(max = 60, message = "Demasiados equipos") List<Long> teamIds,
        @Size(max = 2000, message = "Demasiados partidos") List<Long> includedMatchIds,
        @Size(max = 2000, message = "Demasiados partidos") List<Long> excludedMatchIds,
        @Size(max = 8, message = "Como mucho 8 competiciones") List<Long> competitionIds,
        EventSeries eventSeries,
        @Size(max = 3, message = "Elige como mucho las tres partes de la cartelera") List<CardSegment> cardSegments) {

    public MatchSelectionRequest(MatchSelectionMode mode, List<Long> teamIds, List<Long> includedMatchIds,
                                 List<Long> excludedMatchIds, List<Long> competitionIds, EventSeries eventSeries) {
        this(mode, teamIds, includedMatchIds, excludedMatchIds, competitionIds, eventSeries, null);
    }

    public MatchSelectionRequest(MatchSelectionMode mode, List<Long> teamIds, List<Long> includedMatchIds,
                                 List<Long> excludedMatchIds, List<Long> competitionIds) {
        this(mode, teamIds, includedMatchIds, excludedMatchIds, competitionIds, null);
    }

    public MatchSelectionRequest(MatchSelectionMode mode, List<Long> teamIds, List<Long> includedMatchIds,
                                 List<Long> excludedMatchIds) {
        this(mode, teamIds, includedMatchIds, excludedMatchIds, null);
    }

    public List<Long> teamIdsOrEmpty() {
        return teamIds == null ? List.of() : teamIds;
    }

    public List<Long> includedOrEmpty() {
        return includedMatchIds == null ? List.of() : includedMatchIds;
    }

    public List<Long> excludedOrEmpty() {
        return excludedMatchIds == null ? List.of() : excludedMatchIds;
    }

    public List<Long> competitionIdsOrEmpty() {
        return competitionIds == null ? List.of() : competitionIds;
    }
}
