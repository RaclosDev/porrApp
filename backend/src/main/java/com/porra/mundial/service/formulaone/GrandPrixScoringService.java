package com.porra.mundial.service.formulaone;

import com.porra.mundial.model.Edition;
import com.porra.mundial.model.Match;
import com.porra.mundial.model.MatchPrediction;
import com.porra.mundial.model.Prediction;
import com.porra.mundial.model.RaceDriver;
import com.porra.mundial.model.RaceWeekend;
import com.porra.mundial.repository.MatchPredictionRepository;
import com.porra.mundial.repository.PredictionRepository;
import com.porra.mundial.repository.RaceDriverRepository;
import com.porra.mundial.repository.RaceWeekendRepository;
import com.porra.mundial.scoring.ScoringRuleSet;
import com.porra.mundial.service.prediction.ScoreInvalidationService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * Guarda los puntos de las predicciones de Gran Premio en sus filas de {@code pronosticos_partido}: la
 * clasificación de la liga los suma como los de cualquier partido y su desglose sale por Gran Premio.
 */
@Service
@RequiredArgsConstructor
public class GrandPrixScoringService {

    private final MatchPredictionRepository matchPredictionRepository;
    private final PredictionRepository predictionRepository;
    private final RaceWeekendRepository raceWeekendRepository;
    private final RaceDriverRepository raceDriverRepository;
    private final ScoreInvalidationService scoreInvalidationService;

    /**
     * Puntúa todas las predicciones de un Gran Premio con su resultado.
     *
     * @return predicciones puntuadas
     */
    @Transactional
    public int scoreWeekend(Match match, RaceWeekend weekend) {
        if (match == null || match.getId() == null || weekend == null || !weekend.hasPodium()) return 0;
        List<MatchPrediction> picks = matchPredictionRepository.findByMatchId(match.getId());
        return apply(picks, Map.of(match.getId(), weekend));
    }

    /** Vuelve a puntuar los Grandes Premios ya disputados de una edición (al cambiar su puntuación). */
    @Transactional
    public int rescoreEdition(Edition edition) {
        if (edition == null || edition.getId() == null) return 0;
        List<MatchPrediction> picks = matchPredictionRepository.findWithMatchByPredictionEditionId(edition.getId());
        Set<Long> matchIds = picks.stream().map(p -> p.getMatch().getId()).collect(Collectors.toSet());
        Map<Long, RaceWeekend> weekends = raceWeekendRepository.findByMatchIdIn(matchIds).stream()
                .collect(Collectors.toMap(RaceWeekend::getMatchId, w -> w));
        return apply(picks, weekends);
    }

    private int apply(List<MatchPrediction> picks, Map<Long, RaceWeekend> weekends) {
        if (picks.isEmpty()) return 0;
        Map<Long, String> names = driverNames(weekends.values());
        Map<Long, ScoringRuleSet> rulesByEdition = new HashMap<>();
        Set<Prediction> affected = new HashSet<>();
        List<MatchPrediction> scored = new ArrayList<>();
        for (MatchPrediction pick : picks) {
            RaceWeekend weekend = pick.getMatch() == null ? null : weekends.get(pick.getMatch().getId());
            Prediction prediction = pick.getPrediction();
            Edition edition = prediction == null ? null : prediction.getEdition();
            if (weekend == null || edition == null) continue;
            ScoringRuleSet rules = rulesByEdition.computeIfAbsent(edition.getId(), id -> ScoringRuleSet.forEdition(edition));
            GrandPrixScoring.Result result = GrandPrixScoring.score(pick, weekend, rules, names);
            if (result == null) continue;
            String details = pick.getMatch().getRound() + ": " + result.details();
            pick.setPointsAwarded(result.points());
            pick.setScoringDetails(details.length() > 255 ? details.substring(0, 252) + "…" : details);
            pick.setIsExactScore(null);
            pick.setIsCorrectSign(null);
            scored.add(pick);
            affected.add(prediction);
        }
        matchPredictionRepository.saveAll(scored);
        for (Prediction prediction : affected) {
            prediction.setScoreCalculatedAt(null);
            predictionRepository.save(prediction);
        }
        scoreInvalidationService.evictLeaderboardAfterCommit();
        return scored.size();
    }

    private Map<Long, String> driverNames(java.util.Collection<RaceWeekend> weekends) {
        Set<Long> ids = weekends.stream()
                .flatMap(w -> Stream.of(w.getFirstDriverId(), w.getSecondDriverId(), w.getThirdDriverId(),
                        w.getPoleDriverId(), w.getFastestLapDriverId()))
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        Map<Long, String> names = new HashMap<>();
        for (RaceDriver driver : raceDriverRepository.findAllById(ids)) {
            names.put(driver.getId(), driver.getShortName() != null ? driver.getShortName() : driver.getName());
        }
        return names;
    }
}
