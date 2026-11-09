package com.porra.mundial.service.sync;

import com.porra.mundial.model.Competition;
import com.porra.mundial.model.Match;
import com.porra.mundial.service.tournament.KnockoutBracketService;
import com.porra.mundial.service.tournament.StandingsService;

import java.util.List;

/** Los torneos con fase de grupos tienen clasificación de grupos y cuadro oficiales, que se recalculan aquí. */
final class GroupTournamentTables {

    private GroupTournamentTables() {
    }

    static boolean applies(Competition competition) {
        return competition.isGroupTournament();
    }

    /**
     * Coloca a los ganadores de las eliminatorias y recalcula la clasificación de grupos con una sola
     * lectura de los partidos del torneo.
     *
     * @return número de partidos de eliminatorias actualizados
     */
    static int refresh(Competition competition, KnockoutBracketService knockout, StandingsService standings) {
        List<Match> matches = knockout.matchesOf(competition);
        int placed = knockout.propagateKnockoutWinners(competition, matches);
        standings.recalculate(competition, matches);
        return placed;
    }
}
