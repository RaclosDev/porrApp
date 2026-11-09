package app.porrapp.model;

import app.porrapp.sports.TennisTournaments;

/** Cuadros que sigue una liga de tenis de varios torneos: el masculino (ATP), el femenino (WTA) o los dos. */
public enum TennisTour {
    ATP,
    WTA,
    BOTH;

    public boolean includes(TennisTournaments.Draw draw) {
        return this == BOTH || (this == ATP) == (draw == TennisTournaments.Draw.MEN);
    }
}
