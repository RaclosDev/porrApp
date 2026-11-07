package com.porra.mundial.dto;

import java.util.List;

/**
 * Situación del usuario en una liga superviviente: si sigue vivo, cuántas jornadas ha superado y
 * qué equipo eligió en cada una (un equipo ya usado no puede repetirse).
 *
 * @param eliminatedRound jornada en que cayó, o null si sigue vivo
 * @param missed          cayó por no elegir equipo en esa jornada
 */
public record SurvivorStatusDTO(boolean eliminated, int survived, String eliminatedRound, boolean missed,
                                List<Pick> picks) {

    /**
     * @param result WON (su equipo ganó), LOST (no ganó: eliminado) o PENDING (por jugar o en juego)
     */
    public record Pick(Long matchId, String round, Long teamId, String teamName, String teamLogo, String result) {}

    public static SurvivorStatusDTO empty() {
        return new SurvivorStatusDTO(false, 0, null, false, List.of());
    }
}
