package com.porra.mundial.service.league;

import com.porra.mundial.model.PredictionLockMode;
import com.porra.mundial.scoring.ScoringRuleSet;

import java.time.Instant;

/**
 * Ajustes que se pueden dejar fijados al crear una liga, los mismos que el administrador cambia
 * después en su administración. Los nulos se quedan con el valor por defecto.
 *
 * @param rules             normas de la liga (texto libre)
 * @param entryFee          si la liga tiene cuota de inscripción
 * @param scoring           puntuación; null para la de por defecto
 * @param lockMode          cómo se cierran las predicciones; null para el cierre por defecto
 * @param lockOffsetMinutes margen antes del partido en los cierres que dependen de los partidos
 * @param lockDate          fecha de cierre cuando el modo es {@link PredictionLockMode#FIXED_DATE}
 */
public record LeagueSetup(String rules, Boolean entryFee, ScoringRuleSet scoring,
                          PredictionLockMode lockMode, Integer lockOffsetMinutes, Instant lockDate) {

    /** Sin ajustes: la liga se crea como hasta ahora. */
    public static final LeagueSetup NONE = new LeagueSetup(null, null, null, null, null, null);

    public LeagueSetup {
        rules = rules == null || rules.isBlank() ? null : rules.trim();
    }

    boolean hasLeagueFields() {
        return rules != null || Boolean.TRUE.equals(entryFee);
    }

    boolean isEmpty() {
        return !hasLeagueFields() && scoring == null && lockMode == null;
    }
}
