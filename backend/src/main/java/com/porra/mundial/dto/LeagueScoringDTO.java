package com.porra.mundial.dto;

import com.porra.mundial.model.Edition;
import com.porra.mundial.scoring.ScoringRuleSet;

/**
 * Puntuación de una liga: las reglas de su edición activa junto a las de por defecto, para que
 * el panel pueda mostrar cuánto da cada acierto y restaurarlas.
 *
 * @param poolFormat formato de la porra (FULL_BRACKET, KNOCKOUTS_ONLY, MATCH_DAY), que decide qué reglas se aplican
 * @param pichichi   si la edición puntúa al máximo goleador
 * @param editable   si quien consulta puede cambiarlas: el administrador de la liga
 * @param maxPoints  máximo que admite cada regla
 * @param rules      reglas con las que puntúa la edición
 * @param defaults   reglas por defecto
 * @param knockoutDraw eliminatorias sorteadas ronda a ronda: los puntos son por eliminatoria acertada en cada ronda
 * @param fights     liga de la UFC: se puntúan el ganador, el método y el asalto de cada pelea
 */
public record LeagueScoringDTO(
        String poolFormat,
        boolean pichichi,
        boolean editable,
        int maxPoints,
        ScoringRuleSet rules,
        ScoringRuleSet defaults,
        boolean knockoutDraw,
        boolean fights) {

    @com.fasterxml.jackson.annotation.JsonProperty("matchSignOnly")
    public boolean matchSignOnly() {
        return ScoringRuleSet.MATCH_SIGN_ONLY;
    }

    public static LeagueScoringDTO of(Edition edition, boolean editable) {
        return new LeagueScoringDTO(
                edition.getPoolFormat() != null ? edition.getPoolFormat().name() : null,
                edition.isPichichi(),
                editable,
                ScoringRuleSet.MAX_POINTS,
                ScoringRuleSet.forEdition(edition),
                ScoringRuleSet.defaultWorldCup2026(),
                com.porra.mundial.service.prediction.DrawnKnockout.applies(edition),
                com.porra.mundial.model.Sport.isMma(edition.getCompetition()));
    }
}
