package com.porra.mundial.scoring;

import com.porra.mundial.dto.ParticipantScoreDTO;

/**
 * Estrategia de puntuacion para evaluar pronosticos de torneos.
 * Permite cambiar o personalizar reglas de puntos por competicion o formato de porra.
 */
public interface ScoringStrategy {

    /**
     * Evalua todas las fases del torneo y calcula los puntos acumulados por el participante.
     *
     * @param score DTO mutable donde se acumulan las puntuaciones por fase y el desglose detallado.
     * @param ctx Contexto que contiene la prediccion del participante y los resultados oficiales.
     */
    void evaluateScores(ParticipantScoreDTO score, CalculationContext ctx);

    /**
     * La misma estrategia puntuando con otras reglas, por ejemplo las que ha fijado una liga.
     *
     * @param rules reglas a aplicar; null equivale a las de por defecto
     */
    ScoringStrategy withRules(ScoringRuleSet rules);
}
