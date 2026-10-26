package com.porra.mundial.scoring;

import com.porra.mundial.dto.PredictionDataDTO;
import java.util.List;
import java.util.Map;

/**
 * Contexto inmutable que contiene la prediccion de un participante frente al cuadro oficial
 * y el estado actual de partidos y clasificaciones.
 */
public record CalculationContext(
        PredictionDataDTO part,
        PredictionDataDTO off,
        Map<String, Map<String, Map<String, Integer>>> officialPoints,
        Map<String, List<String>> orderedTeamsPerGroup,
        List<String> bestVirtualThirds,
        List<Map<String, Object>> allScorers,
        List<String> offOctavos,
        List<String> offQf,
        List<String> offSf,
        List<String> offFinal,
        String offChampion
) {}
