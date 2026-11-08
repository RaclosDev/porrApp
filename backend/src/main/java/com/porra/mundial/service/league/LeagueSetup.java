package com.porra.mundial.service.league;

import com.porra.mundial.dto.MatchSelectionRequest;
import com.porra.mundial.model.MatchSelectionMode;

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
 * @param matchSelection    partidos que entran en una liga por jornadas; null para todos
 */
public record LeagueSetup(String rules, Boolean entryFee, ScoringRuleSet scoring,
                          PredictionLockMode lockMode, Integer lockOffsetMinutes, Instant lockDate,
                          MatchSelectionRequest matchSelection) {

    /** Sin ajustes: la liga se crea como hasta ahora. */
    public static final LeagueSetup NONE = new LeagueSetup(null, null, null, null, null, null, null);

    public LeagueSetup(String rules, Boolean entryFee, ScoringRuleSet scoring, PredictionLockMode lockMode,
                       Integer lockOffsetMinutes, Instant lockDate) {
        this(rules, entryFee, scoring, lockMode, lockOffsetMinutes, lockDate, null);
    }

    public LeagueSetup {
        rules = rules == null || rules.isBlank() ? null : rules.trim();
        // «Todos los partidos» sin más es lo de por defecto. Con varias competiciones no se descarta: la
        // selección valida la combinación (los dos cuadros de un torneo de tenis sí, el resto no) y, si no
        // vale, no se crea la liga en vez de quedarse con la competición principal sin avisar.
        if (matchSelection != null && matchSelection.mode() == MatchSelectionMode.ALL
                && matchSelection.eventSeries() == null && matchSelection.cardSegments() == null
                && matchSelection.tennisScope() == null
                && matchSelection.competitionIdsOrEmpty().stream().distinct().count() <= 1) {
            matchSelection = null;
        }
    }

    boolean hasLeagueFields() {
        return rules != null || Boolean.TRUE.equals(entryFee);
    }

    boolean isEmpty() {
        return !hasLeagueFields() && scoring == null && lockMode == null && matchSelection == null;
    }
}
