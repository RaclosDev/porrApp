package com.porra.mundial.service.sync;

import com.porra.mundial.service.tournament.StandingsService;
import com.porra.mundial.service.tournament.KnockoutBracketService;
import com.porra.mundial.model.Competition;
import com.porra.mundial.model.Match;

import java.util.List;

/** El Mundial es la única competición con grupos y cuadro oficiales que se recalculan aquí. */
final class WorldCupTables {

    private WorldCupTables() {
    }

    static boolean isWorldCup(Competition competition) {
        return Competition.WORLD_CUP_EXTERNAL_ID.equalsIgnoreCase(competition.getExternalId());
    }

    /**
     * Coloca a los ganadores de las eliminatorias y recalcula la clasificación de grupos con una sola
     * lectura de los partidos del Mundial.
     *
     * @return número de partidos de eliminatorias actualizados
     */
    static int refresh(KnockoutBracketService knockout, StandingsService standings) {
        List<Match> worldCupMatches = knockout.worldCupMatches();
        int placed = knockout.propagateKnockoutWinners(worldCupMatches);
        standings.recalculateStandingsFromMatches(worldCupMatches);
        return placed;
    }
}
