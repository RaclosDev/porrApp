package com.porra.mundial.scoring;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.porra.mundial.model.Edition;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Parametrizacion versionada de reglas de puntuacion para torneos y porras.
 */
@Data
@Builder
@NoArgsConstructor
// Privado para que Jackson rellene con setters: las reglas que falten en un JSON conservan su valor por defecto.
@AllArgsConstructor(access = AccessLevel.PRIVATE)
@JsonIgnoreProperties(ignoreUnknown = true)
public class ScoringRuleSet {

    /** Puntos máximos que admite cada regla. */
    public static final int MAX_POINTS = 1000;

    private static final ObjectMapper MAPPER = new ObjectMapper();

    // Fase de grupos
    @Builder.Default
    private int groupQualifierPoints = 10;
    @Builder.Default
    private int groupExactPositionPoints = 10;

    // Rondas eliminatorias
    @Builder.Default
    private int roundOf32Points = 25;
    @Builder.Default
    private int roundOf16Points = 30;
    @Builder.Default
    private int quarterFinalPoints = 40;
    @Builder.Default
    private int semiFinalPoints = 60;
    @Builder.Default
    private int championPoints = 200;
    @Builder.Default
    private int runnerUpPoints = 150;
    @Builder.Default
    private int thirdPlacePoints = 100;
    @Builder.Default
    private int fourthPlacePoints = 75;

    // Goleador / Pichichi
    @Builder.Default
    private int topScorerPoints = 200;

    // Puntuacion de partidos directos (1X2 y marcador exacto)
    @Builder.Default
    private int exactScorePoints = 5;
    @Builder.Default
    private int correctSignPoints = 3;
    @Builder.Default
    private int goalDiffBonusPoints = 1;

    public static ScoringRuleSet defaultWorldCup2026() {
        return ScoringRuleSet.builder().build();
    }

    /** Reglas guardadas en la edición; las del Mundial 2026 si no tiene. */
    public static ScoringRuleSet forEdition(Edition edition) {
        return edition != null ? fromJson(edition.getScoringRulesJson()) : defaultWorldCup2026();
    }

    public static ScoringRuleSet fromJson(String json) {
        if (json == null || json.isBlank()) {
            return defaultWorldCup2026();
        }
        try {
            return MAPPER.readValue(json, ScoringRuleSet.class);
        } catch (Exception e) {
            return defaultWorldCup2026();
        }
    }

    /**
     * Reglas que envía el administrador de una liga. Las que no vengan toman su valor por defecto.
     *
     * @throws IllegalArgumentException si alguna no es un número entero entre 0 y {@link #MAX_POINTS}
     */
    public static ScoringRuleSet fromRequest(JsonNode body) {
        if (body == null || !body.isObject()) {
            throw new IllegalArgumentException("Faltan las reglas de puntuación.");
        }
        // Jackson convertiría 2.5 en 2: los decimales se rechazan antes de leer las reglas.
        for (String rule : defaultWorldCup2026().asMap().keySet()) {
            JsonNode value = body.get(rule);
            if (value != null && !(value.isIntegralNumber() && value.canConvertToInt())) {
                throw new IllegalArgumentException(String.format(
                        "La regla %s tiene que ser un número entero entre 0 y %d.", rule, MAX_POINTS));
            }
        }
        ScoringRuleSet rules = MAPPER.treeToValue(body, ScoringRuleSet.class);
        rules.validate();
        return rules;
    }

    public String toJson() {
        try {
            return MAPPER.writeValueAsString(this);
        } catch (Exception e) {
            return "{}";
        }
    }

    /** Cada regla con su valor, con los mismos nombres que en el JSON. */
    public Map<String, Integer> asMap() {
        return MAPPER.convertValue(this, new TypeReference<LinkedHashMap<String, Integer>>() {});
    }

    /**
     * Comprueba que cada regla esté entre 0 y {@link #MAX_POINTS} puntos.
     *
     * @throws IllegalArgumentException con la primera regla fuera de rango
     */
    public void validate() {
        asMap().forEach((rule, points) -> {
            if (points < 0 || points > MAX_POINTS) {
                throw new IllegalArgumentException(String.format(
                        "La regla %s vale %d: tiene que estar entre 0 y %d puntos.", rule, points, MAX_POINTS));
            }
        });
    }
}
