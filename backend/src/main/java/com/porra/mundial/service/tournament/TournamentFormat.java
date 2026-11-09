package com.porra.mundial.service.tournament;

import com.porra.mundial.model.Competition;

/**
 * Forma de la fase de grupos de un torneo: lo que cambia de un torneo a otro.
 *
 * @param bestThirds          terceros de grupo que pasan a las eliminatorias, además de los dos primeros
 * @param groupMatchesPerTeam partidos de grupo que juega cada equipo
 * @param seededGroups        los grupos están sorteados antes de tener calendario: cada equipo lleva el
 *                            suyo; si no, los grupos son los que digan los partidos del torneo
 */
public record TournamentFormat(int bestThirds, int groupMatchesPerTeam, boolean seededGroups) {

    /** Mundial de 48 selecciones: 12 grupos de 4, pasan los dos primeros y los 8 mejores terceros. */
    static final TournamentFormat WORLD_CUP_2026 = new TournamentFormat(8, 3, true);

    /** Torneo cuyos grupos salen de su calendario y en el que no pasa ningún tercero. */
    static final TournamentFormat FROM_CALENDAR = new TournamentFormat(0, 0, false);

    public static TournamentFormat of(Competition competition) {
        return competition != null && competition.isWorldCup() ? WORLD_CUP_2026 : FROM_CALENDAR;
    }

    /** Algún tercero pasa: los terceros se ordenan entre sí y los peores quedan eliminados. */
    public boolean ranksThirds() {
        return bestThirds > 0;
    }
}
