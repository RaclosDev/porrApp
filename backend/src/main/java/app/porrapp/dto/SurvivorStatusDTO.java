package app.porrapp.dto;

import java.util.List;

/**
 * Situación del usuario en una liga superviviente: si sigue vivo, cuántas jornadas ha superado y
 * qué equipo eligió en cada una (un equipo ya usado no puede repetirse).
 *
 * @param eliminatedRound jornada en que cayó, o null si sigue vivo
 * @param missed          cayó por no elegir equipo en esa jornada
 * @param livesLeft       vidas que le quedan
 * @param lives           vidas con las que empieza cada participante en esta liga
 * @param drawSurvives    en esta liga un empate de su equipo también supera la jornada
 */
public record SurvivorStatusDTO(boolean eliminated, int survived, String eliminatedRound, boolean missed,
                                List<Pick> picks, int livesLeft, int lives, boolean drawSurvives) {

    /**
     * @param result WON (superó la jornada), LOST (no la superó: vida perdida o eliminado) o PENDING
     */
    public record Pick(Long matchId, String round, Long teamId, String teamName, String teamLogo, String result) {}

    public static SurvivorStatusDTO empty() {
        return new SurvivorStatusDTO(false, 0, null, false, List.of(), 1, 1, false);
    }
}
