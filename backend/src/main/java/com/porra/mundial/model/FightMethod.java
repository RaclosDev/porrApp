package com.porra.mundial.model;

import java.util.Locale;

/** Cómo acaba una pelea de MMA. Solo KO/TKO, sumisión y decisión se pueden predecir. */
public enum FightMethod {
    KO_TKO,
    SUBMISSION,
    DECISION,
    DRAW,
    NO_CONTEST,
    DISQUALIFICATION,
    OTHER;

    /** Métodos entre los que elige quien predice. */
    public boolean predictable() {
        return this == KO_TKO || this == SUBMISSION || this == DECISION;
    }

    /** La pelea acaba antes del límite: tiene sentido predecir el asalto. */
    public boolean finish() {
        return this == KO_TKO || this == SUBMISSION;
    }

    /**
     * Método a partir del {@code status.result.name} de ESPN ({@code kotko}, {@code tko---doctors-stoppage},
     * {@code submission}, {@code decision---unanimous}, {@code draw}, {@code no-contest}, {@code dq}…).
     *
     * @return null si ESPN aún no da el resultado
     */
    public static FightMethod fromEspn(String name) {
        if (name == null || name.isBlank()) return null;
        String value = name.trim().toLowerCase(Locale.ROOT);
        if (value.startsWith("ko") || value.startsWith("tko")) return KO_TKO;
        if (value.startsWith("sub")) return SUBMISSION;
        if (value.startsWith("decision")) return DECISION;
        if (value.startsWith("draw")) return DRAW;
        if (value.startsWith("no-contest") || value.startsWith("nc")) return NO_CONTEST;
        if (value.equals("dq") || value.startsWith("disq")) return DISQUALIFICATION;
        return OTHER;
    }

    /** Método que elige un usuario; null si no eligió o no es uno de los que se predicen. */
    public static FightMethod predicted(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            FightMethod method = valueOf(value.trim().toUpperCase(Locale.ROOT));
            return method.predictable() ? method : null;
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
