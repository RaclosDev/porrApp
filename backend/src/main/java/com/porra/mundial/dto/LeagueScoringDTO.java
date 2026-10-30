package com.porra.mundial.dto;

import com.porra.mundial.model.Edition;
import com.porra.mundial.scoring.ScoringRuleSet;

/**
 * Puntuación de una liga: las reglas de su edición activa junto a las de por defecto, para que
 * el panel pueda mostrar cuánto da cada acierto y restaurarlas.
 *
 * @param poolFormat formato de la porra (FULL_BRACKET, KNOCKOUTS_ONLY, MATCH_DAY), que decide qué reglas se aplican
 * @param pichichi   si la edición puntúa al máximo goleador
 * @param editable   si quien consulta puede cambiarlas: el administrador de una liga que no sea la Porra Global
 * @param maxPoints  máximo que admite cada regla
 * @param rules      reglas con las que puntúa la edición
 * @param defaults   reglas por defecto
 */
public record LeagueScoringDTO(
        String poolFormat,
        boolean pichichi,
        boolean editable,
        int maxPoints,
        ScoringRuleSet rules,
        ScoringRuleSet defaults) {

    public static LeagueScoringDTO of(Edition edition, boolean editable) {
        return new LeagueScoringDTO(
                edition.getPoolFormat() != null ? edition.getPoolFormat().name() : null,
                edition.isPichichi(),
                editable,
                ScoringRuleSet.MAX_POINTS,
                ScoringRuleSet.forEdition(edition),
                ScoringRuleSet.defaultWorldCup2026());
    }
}
