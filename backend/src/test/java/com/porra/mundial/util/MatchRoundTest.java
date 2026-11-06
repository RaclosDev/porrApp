package com.porra.mundial.util;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Function;

import static org.assertj.core.api.Assertions.assertThat;

class MatchRoundTest {

    @Test
    void sortsNumberedMatchdaysAndKeepsOtherRoundsInPlace() {
        List<String> rounds = new ArrayList<>(List.of(
                "Jornada 3", "Jornada 6", "Jornada 4", "Octavos de final", "Jornada 5", "Final"));

        MatchRound.sortNumberedMatchdays(rounds, Function.identity());

        assertThat(rounds).containsExactly(
                "Jornada 3", "Jornada 4", "Jornada 5", "Octavos de final", "Jornada 6", "Final");
    }

    @Test
    void readsTheMatchdayNumber() {
        assertThat(MatchRound.matchdayNumber("Jornada 12")).isEqualTo(12);
        assertThat(MatchRound.matchdayNumber("Fecha 2026-11-24")).isNull();
        assertThat(MatchRound.matchdayNumber(null)).isNull();
    }
}
