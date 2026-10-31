package com.porra.mundial.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.Map;
import tools.jackson.databind.annotation.JsonSerialize;

/**
 * Resumen de puntos de una jornada concreta para una liga.
 * Permite al frontend navegar entre jornadas sin recalcular el ranking completo.
 */
@Data
@Builder
public class MatchdayPointsDTO {
    /** Etiqueta visible de la jornada (por ejemplo, "Jornada 12" o "Grupo A"). */
    private String label;
    /** Fecha del primer partido de la jornada. */
    @JsonSerialize(using = MadridDateTimeSerializer.class)
    private LocalDateTime date;
    /** Indica si ya no queda ningún partido jugable pendiente. */
    private boolean finished;
    /** Marca la primera jornada con partidos pendientes o, si todo terminó, la última. */
    private boolean current;
    /** Número de partidos que componen la jornada. */
    private int matchCount;
    /** Puntos obtenidos por cada pronóstico (id de Prediction) en esta jornada. */
    private Map<Long, Integer> pointsByPrediction;
}
