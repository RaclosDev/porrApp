package com.porra.mundial.model;

import java.util.Collection;
import java.util.EnumSet;
import java.util.Set;

/**
 * Partes de la cartelera de una velada de la UFC: la estelar ({@link Fight#MAIN_CARD}), las preliminares y
 * las preliminares tempranas. Una liga de la UFC puede seguir solo algunas; sin elegir, todas.
 */
public enum CardSegment {
    EARLY_PRELIMS,
    PRELIMS,
    MAIN;

    /**
     * Partes que sigue una liga, normalizadas: null si son todas (o ninguna, que no se guarda), para que
     * las ligas que no eligen nada sigan como estaban.
     */
    public static Set<CardSegment> normalized(Collection<CardSegment> segments) {
        if (segments == null || segments.isEmpty()) return null;
        EnumSet<CardSegment> set = EnumSet.noneOf(CardSegment.class);
        segments.stream().filter(java.util.Objects::nonNull).forEach(set::add);
        return set.isEmpty() || set.size() == values().length ? null : set;
    }

    /**
     * Si una pelea de esa parte ({@link Fight#getCardSegment()}) entra en una liga que sigue {@code segments}
     * (null: todas). Una pelea sin parte conocida entra siempre.
     */
    public static boolean includes(Set<CardSegment> segments, String fightSegment) {
        if (segments == null || fightSegment == null) return true;
        CardSegment segment = of(fightSegment);
        return segment == null || segments.contains(segment);
    }

    /** Parte de una pelea por cómo la guarda {@link Fight}; null si no se reconoce. */
    public static CardSegment of(String fightSegment) {
        if (fightSegment == null) return null;
        for (CardSegment segment : values()) {
            if (segment.name().equalsIgnoreCase(fightSegment.trim())) return segment;
        }
        return null;
    }
}
