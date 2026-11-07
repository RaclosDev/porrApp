package com.porra.mundial.dto;

import java.util.List;

/**
 * Situación del usuario en una liga superviviente: si sigue vivo, cuántas jornadas ha superado y
 * qué equipo eligió en cada una (un equipo ya usado no puede repetirse).
 */
public record SurvivorStatusDTO(boolean eliminated, int survived, List<Pick> picks) {

    /**
     * @param result WON (su equipo ganó), LOST (no ganó: eliminado) o PENDING (por jugar o en juego)
     */
    public record Pick(Long matchId, String round, Long teamId, String teamName, String teamLogo, String result) {}

    public static SurvivorStatusDTO empty() {
        return new SurvivorStatusDTO(false, 0, List.of());
    }
}
