package com.porra.mundial.scoring;

import com.porra.mundial.dto.BetDataDTO;
import com.porra.mundial.dto.ParticipantScoreDTO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.*;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class WorldCup2026ScoringStrategyTest {

    private WorldCup2026ScoringStrategy strategy;

    @BeforeEach
    void setUp() {
        strategy = new WorldCup2026ScoringStrategy();
    }

    @Test
    @DisplayName("Debe otorgar 20 puntos por clasificado en posicion exacta y 200 por acertar campeon")
    void evaluateScores_awardsPointsCorrectly() {
        BetDataDTO participant = new BetDataDTO();
        participant.setGroups(Map.of("A", List.of("España", "Alemania", "Japón", "Costa Rica")));
        participant.setChampion("España");

        BetDataDTO official = new BetDataDTO();
        official.setGroups(Map.of("A", List.of("España", "Alemania", "Japón", "Costa Rica")));

        Map<String, List<String>> orderedTeams = Map.of("A", List.of("España", "Alemania", "Japón", "Costa Rica"));
        Map<String, Map<String, Map<String, Integer>>> officialPoints = Map.of(
                "A", Map.of("España", Map.of("mp", 3), "Alemania", Map.of("mp", 3))
        );

        CalculationContext ctx = new CalculationContext(
                participant,
                official,
                officialPoints,
                orderedTeams,
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of("España", "Francia"),
                "España"
        );

        ParticipantScoreDTO score = ParticipantScoreDTO.builder()
                .r1(0).r32(0).r16(0).qf(0).sf(0).finals(0).scorer(0).total(0)
                .log(new ArrayList<>())
                .exactMatches(new HashMap<>())
                .passedTeams(new HashMap<>())
                .build();

        strategy.evaluateScores(score, ctx);

        // España 1º exacto = 20 pts, Alemania 2º exacto = 20 pts -> r1 >= 40
        assertTrue(score.getR1() >= 40);
        // Campeón España acertado = 200 pts
        assertTrue(score.getFinals() >= 200);
        assertEquals(Boolean.TRUE, score.getPassedTeams().get("España"));
    }
}
