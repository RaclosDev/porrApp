package app.porrapp.util;

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

    @Test
    void nflWeeksSortByNumberAndPlayoffRoundsStayAfterThem() {
        List<String> rounds = new ArrayList<>(List.of(
                "Semana 9", "Semana 10", "Semana 18", "Semana 11", "Ronda de comodines", "Super Bowl"));

        MatchRound.sortNumberedMatchdays(rounds, Function.identity());

        assertThat(rounds).containsExactly(
                "Semana 9", "Semana 10", "Semana 11", "Semana 18", "Ronda de comodines", "Super Bowl");
        assertThat(MatchRound.matchdayNumber("Semana 12")).isEqualTo(12);
        // La semana de una liga con varias competiciones no es una jornada numerada.
        assertThat(MatchRound.matchdayNumber("Semana 2026-11-02")).isNull();
    }

    @Test
    void knockoutRoundsHaveSpanishLabelsAndCanBeLookedUpByThem() {
        app.porrapp.model.Match octavos = app.porrapp.model.Match.builder().round("r16").build();

        assertThat(MatchRound.label(octavos)).isEqualTo("Octavos de final");
        assertThat(MatchRound.lookup("Octavos de final").names()).contains("r16");
        assertThat(MatchRound.matches(octavos, "Octavos de final")).isTrue();
        assertThat(MatchRound.matches(octavos, "r16")).isTrue();
    }

    @Test
    void thePlayInOfTheLolWorldsHasASpanishLabel() {
        app.porrapp.model.Match playIn = app.porrapp.model.Match.builder().round("playin").build();

        assertThat(MatchRound.label(playIn)).isEqualTo("Play-in");
        assertThat(MatchRound.matches(playIn, "Play-in")).isTrue();
        assertThat(MatchRound.lookup("Play-in").names()).contains("playin");
    }
    @Test
    void theEarlyRoundsOfTheCopaDelReyHaveASpanishLabel() {
        app.porrapp.model.Match first = app.porrapp.model.Match.builder().round("round1").build();
        app.porrapp.model.Match previous = app.porrapp.model.Match.builder().round("qualifying").build();

        assertThat(MatchRound.label(first)).isEqualTo("Primera ronda");
        assertThat(MatchRound.label(previous)).isEqualTo("Ronda previa");
        assertThat(MatchRound.matches(first, "Primera ronda")).isTrue();
        assertThat(MatchRound.lookup("Primera ronda").names()).contains("round1");
    }
}
