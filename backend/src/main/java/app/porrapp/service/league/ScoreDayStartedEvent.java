package app.porrapp.service.league;

/**
 * Ha empezado un día de juego en una liga de juegos de mesa.
 *
 * @param leagueId liga en la que se juega
 * @param userId   quien lo ha empezado, que no recibe el aviso
 */
public record ScoreDayStartedEvent(Long leagueId, Long userId) {
}
