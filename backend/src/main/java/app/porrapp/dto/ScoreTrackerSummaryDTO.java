package app.porrapp.dto;

/** Marcador en la lista del usuario. */
public record ScoreTrackerSummaryDTO(Long id, String name, boolean owner, int players, int rounds) {
}
