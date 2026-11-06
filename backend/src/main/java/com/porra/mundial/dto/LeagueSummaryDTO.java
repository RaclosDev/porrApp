package com.porra.mundial.dto;

/**
 * Situación del usuario en una de sus ligas, para las tarjetas de Inicio y Mis ligas.
 *
 * @param groupId            liga
 * @param rank               posición (con empates), o null si aún no participa
 * @param points             puntos totales, o null si aún no participa
 * @param participants       participantes del ranking
 * @param pendingPredictions partidos abiertos de los próximos días sin predicción del usuario
 *                           (solo ligas por jornadas; 0 en el resto)
 */
public record LeagueSummaryDTO(Long groupId, Integer rank, Integer points, int participants,
                               int pendingPredictions) {
}
