package com.porra.mundial.dto;

import java.util.List;

/**
 * Partidos para el panel de inicio.
 *
 * @param live en juego
 * @param last últimos terminados
 * @param next próximos
 */
public record MatchRadarDTO(List<MatchResponseDTO> live, List<MatchResponseDTO> last, List<MatchResponseDTO> next) {
}
