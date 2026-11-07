package com.porra.mundial.model;

/** Qué partidos de su competición entran en una liga por jornadas. */
public enum MatchSelectionMode {
    /** Todos los partidos de la competición, salvo los quitados a mano. */
    ALL,
    /** Los de los equipos seguidos y los añadidos a mano, salvo los quitados a mano. */
    CUSTOM
}
