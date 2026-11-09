package app.porrapp.scoring;

import app.porrapp.dto.PredictionDataDTO;
import app.porrapp.dto.TopScorerDTO;
import java.util.List;
import java.util.Map;

/**
 * Contexto inmutable que contiene la prediccion de un participante frente al cuadro oficial
 * y el estado actual de partidos y clasificaciones.
 *
 * @param scorerChoice pichichi de la porra si no vale el escrito en el cuadro tal cual (lo asignó el
 *                     administrador); null para usar el del cuadro
 */
public record CalculationContext(
        PredictionDataDTO part,
        PredictionDataDTO off,
        Map<String, Map<String, Map<String, Integer>>> officialPoints,
        Map<String, List<String>> orderedTeamsPerGroup,
        List<String> bestVirtualThirds,
        List<TopScorerDTO> allScorers,
        List<String> offOctavos,
        List<String> offQf,
        List<String> offSf,
        List<String> offFinal,
        String offChampion,
        ScorerChoice scorerChoice
) {
    /** Sin pichichi aparte: el que va escrito en el cuadro del participante. */
    public CalculationContext(PredictionDataDTO part, PredictionDataDTO off,
                              Map<String, Map<String, Map<String, Integer>>> officialPoints,
                              Map<String, List<String>> orderedTeamsPerGroup, List<String> bestVirtualThirds,
                              List<TopScorerDTO> allScorers, List<String> offOctavos, List<String> offQf,
                              List<String> offSf, List<String> offFinal, String offChampion) {
        this(part, off, officialPoints, orderedTeamsPerGroup, bestVirtualThirds, allScorers, offOctavos, offQf,
                offSf, offFinal, offChampion, null);
    }
}
