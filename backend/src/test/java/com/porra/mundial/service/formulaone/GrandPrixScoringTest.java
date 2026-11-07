package com.porra.mundial.service.formulaone;

import com.porra.mundial.model.MatchPrediction;
import com.porra.mundial.model.RaceWeekend;
import com.porra.mundial.scoring.ScoringRuleSet;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class GrandPrixScoringTest {

    private static final Map<Long, String> NAMES = Map.of(1L, "L. Norris", 2L, "G. Russell", 3L, "K. Antonelli",
            4L, "C. Leclerc");
    private final ScoringRuleSet rules = ScoringRuleSet.defaultWorldCup2026();

    private static RaceWeekend result(Long first, Long second, Long third, Long pole, Long fastestLap) {
        return RaceWeekend.builder().matchId(9L).firstDriverId(first).secondDriverId(second).thirdDriverId(third)
                .poleDriverId(pole).fastestLapDriverId(fastestLap).build();
    }

    private static MatchPrediction pick(Long first, Long second, Long third, Long pole, Long fastestLap) {
        return MatchPrediction.builder().raceFirstDriverId(first).raceSecondDriverId(second).raceThirdDriverId(third)
                .racePoleDriverId(pole).raceFastestLapDriverId(fastestLap).build();
    }

    @Test
    @DisplayName("Todo acertado: 3 puestos exactos, pole y vuelta rápida")
    void perfectWeekend() {
        var score = GrandPrixScoring.score(pick(1L, 2L, 3L, 1L, 4L), result(1L, 2L, 3L, 1L, 4L), rules, NAMES);

        assertThat(score.points()).isEqualTo(3 * 10 + 5 + 3);
        assertThat(score.details()).isEqualTo(
                "L. Norris 1.º (+10) · G. Russell 2.º (+10) · K. Antonelli 3.º (+10) · pole (+5) · vuelta rápida (+3)");
    }

    @Test
    @DisplayName("Un piloto en el podio pero en otro puesto suma menos que el puesto exacto")
    void podiumInOtherPlace() {
        var score = GrandPrixScoring.score(pick(1L, 3L, 4L, 2L, null), result(1L, 2L, 3L, 1L, 4L), rules, NAMES);

        // Norris exacto (10) + Antonelli en el podio (4); Leclerc no sube, la pole falla y no hay vuelta rápida.
        assertThat(score.points()).isEqualTo(14);
        assertThat(score.details()).isEqualTo("L. Norris 1.º (+10) · K. Antonelli en el podio (+4)");
    }

    @Test
    @DisplayName("Sin vuelta rápida en ESPN esa parte no suma ni resta; sin podio no se puntúa")
    void missingParts() {
        assertThat(GrandPrixScoring.score(pick(2L, 1L, 4L, 3L, 4L), result(1L, 2L, 3L, 1L, null), rules, NAMES))
                .satisfies(score -> {
                    assertThat(score.points()).isEqualTo(8);
                    assertThat(score.details()).contains("en el podio");
                });
        assertThat(GrandPrixScoring.score(pick(1L, 2L, 3L, 1L, null), result(null, null, null, 1L, null), rules, NAMES))
                .isNull();
        assertThat(GrandPrixScoring.score(pick(4L, 4L, 4L, 4L, 1L), result(1L, 2L, 3L, 1L, 2L), rules, NAMES).details())
                .isEqualTo("Sin aciertos");
    }

    @Test
    @DisplayName("Usa los puntos que haya puesto el administrador")
    void customRules() {
        ScoringRuleSet custom = ScoringRuleSet.builder().f1ExactPositionPoints(25).f1PodiumPoints(0)
                .f1PolePoints(7).f1FastestLapPoints(0).build();

        assertThat(GrandPrixScoring.score(pick(1L, 3L, 2L, 1L, 4L), result(1L, 2L, 3L, 1L, 4L), custom, NAMES).points())
                .isEqualTo(25 + 7);
    }

    @Test
    @DisplayName("Los nombres de ESPN pasan a español sin patrocinador")
    void spanishNames() {
        assertThat(GrandPrixNames.spanish("MSC Cruises São Paulo Grand Prix")).isEqualTo("GP de São Paulo");
        assertThat(GrandPrixNames.spanish("Qatar Airways Australian Grand Prix")).isEqualTo("GP de Australia");
        assertThat(GrandPrixNames.spanish("Qatar Airways Qatar Grand Prix")).isEqualTo("GP de Catar");
        assertThat(GrandPrixNames.spanish("Mexico City Grand Prix")).isEqualTo("GP de la Ciudad de México");
        assertThat(GrandPrixNames.spanish("Gulf Air Bahrain Grand Prix in Malaysia")).isEqualTo("GP de Baréin (en Malasia)");
        assertThat(GrandPrixNames.spanish("Etihad Airways Abu Dhabi Grand Prix")).isEqualTo("GP de Abu Dabi");
        assertThat(GrandPrixNames.spanish("Atlantis Grand Prix")).isEqualTo("GP de Atlantis");
    }
}
