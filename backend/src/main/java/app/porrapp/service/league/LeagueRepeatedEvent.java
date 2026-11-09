package app.porrapp.service.league;

/**
 * Una liga se ha repetido para la temporada nueva y sus miembros ya están dentro.
 *
 * @param leagueId la liga nueva
 * @param userId   quien la ha repetido (su administrador), que no recibe el aviso
 * @param season   etiqueta de la temporada nueva; null si no se sabe
 */
public record LeagueRepeatedEvent(Long leagueId, Long userId, String season) {
}
