package com.porra.mundial.model;

/** Cuándo dejan de poder cambiarse los pronósticos de una edición. */
public enum PredictionLockMode {
    /** Todo a la vez, en la fecha que fija el administrador. */
    FIXED_DATE,
    /** Todo a la vez, al empezar el primer partido (menos el margen). */
    FIRST_MATCH,
    /** Cada grupo y cada ronda del cuadro al empezar su primer partido (menos el margen). */
    PER_ROUND,
    /** Cada ganador al empezar su partido; cada grupo al empezar su primer partido (menos el margen). */
    PER_MATCH,
    /** Solo en ligas por jornadas: los partidos de un mismo día al empezar el primero (menos el margen). */
    PER_DAY;

    /** El cierre llega por partes y depende de los partidos, no de una sola fecha. */
    public boolean progressive() {
        return this == PER_ROUND || this == PER_MATCH;
    }
}
