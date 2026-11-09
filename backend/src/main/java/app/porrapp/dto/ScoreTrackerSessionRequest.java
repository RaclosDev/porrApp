package app.porrapp.dto;

/** Sesión nueva; si no trae juego sigue con el de la sesión anterior. */
public record ScoreTrackerSessionRequest(Long gameId) {
}
