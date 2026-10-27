package com.porra.mundial.util;

import com.porra.mundial.model.Match;

/** Calendar grouping when the provider does not supply an official matchday. */
public final class MatchRound {
    private MatchRound() {}

    public static String label(Match match) {
        if (match.getGroupName() != null && !match.getGroupName().isBlank()) {
            return "Grupo " + match.getGroupName();
        }
        if (match.getRound() != null && !match.getRound().isBlank()
                && !"group".equalsIgnoreCase(match.getRound())) {
            return match.getRound();
        }
        return match.getMatchDate() != null ? "Fecha " + match.getMatchDate().toLocalDate() : "Sin jornada";
    }

    public static boolean matches(Match match, String round) {
        return round != null && (round.equalsIgnoreCase(label(match))
                || round.equalsIgnoreCase(match.getRound())
                || round.equalsIgnoreCase(match.getGroupName()));
    }
}
