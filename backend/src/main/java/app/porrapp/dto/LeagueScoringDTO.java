package app.porrapp.dto;

import app.porrapp.model.Edition;
import app.porrapp.model.Sport;
import app.porrapp.scoring.ScoringRuleSet;

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
 * @param nbaSeries  playoffs de la NBA: puntos por serie acertada y extra por acertar en cuántos partidos
 * @param sport      deporte de la competición principal ({@code Sport}): en la NFL se acierta el ganador, sin
 *                   empate; en tenis el ganador de cada ronda y los sets
 * @param tournamentRounds rondas eliminatorias de su torneo con grupos, para enseñar solo sus reglas; null
 *                   si la competición no lo es
 */
public record LeagueScoringDTO(
        String poolFormat,
        boolean pichichi,
        boolean editable,
        int maxPoints,
        ScoringRuleSet rules,
        ScoringRuleSet defaults,
        boolean knockoutDraw,
        boolean fights,
        boolean nbaSeries,
        String sport,
        TournamentRoundsDTO tournamentRounds) {

    @com.fasterxml.jackson.annotation.JsonProperty("matchSignOnly")
    public boolean matchSignOnly() {
        return ScoringRuleSet.MATCH_SIGN_ONLY;
    }

    public static LeagueScoringDTO of(Edition edition, boolean editable) {
        boolean tennis = app.porrapp.model.Sport.isTennis(edition.getCompetition());
        return new LeagueScoringDTO(
                edition.getPoolFormat() != null ? edition.getPoolFormat().name() : null,
                edition.isPichichi(),
                editable,
                ScoringRuleSet.MAX_POINTS,
                ScoringRuleSet.forEdition(edition),
                tennis ? ScoringRuleSet.defaultTennis() : ScoringRuleSet.defaults(),
                app.porrapp.service.prediction.DrawnKnockout.applies(edition),
                Sport.isMma(edition.getCompetition()),
                app.porrapp.service.prediction.DrawnKnockout.applies(edition)
                        && app.porrapp.service.prediction.DrawnKnockout.playsSeries(edition),
                edition.getCompetition() != null
                        ? edition.getCompetition().rulesSport().name() : null,
                TournamentRoundsDTO.of(edition.getCompetition()));
    }
}
