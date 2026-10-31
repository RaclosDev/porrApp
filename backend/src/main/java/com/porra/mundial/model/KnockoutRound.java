package com.porra.mundial.model;

import java.util.Locale;

/** Shared round interpretation for official results and synthetic fixture propagation. */
public enum KnockoutRound {
    ROUND_OF_32, ROUND_OF_16, QUARTER_FINAL, SEMI_FINAL, FINAL, THIRD_PLACE;

    public static KnockoutRound fromLabel(String label) {
        if (label == null) return null;
        String round = label.toLowerCase(Locale.ROOT);
        if (round.contains("group") || round.contains("grupo") || round.contains("jornada")) return null;
        if (round.contains("32") || round.contains("dieciseis") || round.contains("16avo")) return ROUND_OF_32;
        if (round.contains("16") || round.contains("octav")) return ROUND_OF_16;
        if (round.equals("qf") || round.contains("quarter") || round.contains("cuart")) return QUARTER_FINAL;
        if (round.equals("sf") || round.contains("semi")) return SEMI_FINAL;
        if (round.contains("third") || round.contains("tercer") || round.contains("3rd") || round.contains("3er")) return THIRD_PLACE;
        if (round.contains("final")) return FINAL;
        return null;
    }
}
