package com.porra.mundial.service;

import com.porra.mundial.model.Match;
import com.porra.mundial.model.Team;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class OfficialBracketLayoutTest {

    private static final Map<String, List<String>> GROUPS = Map.of(
            "A", List.of("México", "Sudáfrica"),
            "B", List.of("Suiza", "Canadá"));

    @Test
    void firstRoundPlacesEachMatchOnItsFifaBranchWhateverTheHomeSide() {
        // 2A contra 2B es el tercer cruce del cuadro; el proveedor lo da con los equipos al revés.
        Match reversed = match("Canadá", "Sudáfrica");

        List<List<String>> round = OfficialBracketLayout.firstRound(GROUPS, List.of(reversed));

        assertThat(round).hasSize(16);
        assertThat(round.get(2)).containsExactly("Sudáfrica", "Canadá");
        assertThat(round.get(0)).containsExactly(null, null);
    }

    @Test
    void nextRoundPairsAdjacentBranches() {
        List<List<String>> previous = List.of(List.of("A", "B"), List.of("C", "D"));

        List<List<String>> next = OfficialBracketLayout.nextRound(previous, List.of(match("D", "A")));

        assertThat(next).containsExactly(List.of("A", "D"));
    }

    @Test
    void findMatchAcceptsHalfKnownPairsAndIgnoresPlaceholders() {
        Match semi = match("España", "Francia");

        assertThat(OfficialBracketLayout.findMatch(List.of(semi), Arrays.asList("Francia", null))).isSameAs(semi);
        assertThat(OfficialBracketLayout.findMatch(List.of(semi), Arrays.asList(null, null))).isNull();
        assertThat(OfficialBracketLayout.name(Team.builder().name(Team.PLACEHOLDER_NAME).build())).isNull();
    }

    private static Match match(String home, String away) {
        return Match.builder().homeTeam(Team.builder().name(home).build())
                .awayTeam(Team.builder().name(away).build()).build();
    }
}
