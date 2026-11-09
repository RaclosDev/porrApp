package app.porrapp.dto;

import java.util.List;

/**
 * Quién ha pronosticado cada signo de un partido cuyos pronósticos ya se ven.
 *
 * @param home miembros que pronostican la victoria local (1)
 * @param draw miembros que pronostican empate (X)
 * @param away miembros que pronostican la victoria visitante (2)
 */
public record MatchVotersDTO(Long matchId, List<Voter> home, List<Voter> draw, List<Voter> away) {

    /** Un miembro con su nombre y foto públicos en la liga. */
    public record Voter(Long userId, String name, String avatarUrl) {
    }
}
