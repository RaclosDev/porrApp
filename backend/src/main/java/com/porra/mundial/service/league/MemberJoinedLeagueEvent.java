package com.porra.mundial.service.league;

/**
 * Un usuario acaba de unirse a una liga.
 *
 * @param leagueId liga a la que se ha unido
 * @param userId   quien se ha unido, que no recibe el aviso
 */
public record MemberJoinedLeagueEvent(Long leagueId, Long userId) {
}
