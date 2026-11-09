package app.porrapp.sports;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.util.Objects;

import static org.assertj.core.api.Assertions.assertThat;

/** Semanas y rondas de la NFL tal como llegan del marcador de ESPN (eventos reales recortados). */
class NflScheduleTest {

    private static JsonNode events;

    @BeforeAll
    static void load() throws Exception {
        try (var input = NflScheduleTest.class.getResourceAsStream("/espn/nfl-scoreboard.json")) {
            events = new ObjectMapper().readTree(Objects.requireNonNull(input)).path("events");
        }
    }

    private static JsonNode event(String name) {
        for (JsonNode event : events) if (event.path("name").asText().equals(name)) return event;
        throw new IllegalArgumentException(name);
    }

    @Test
    void regularSeasonGamesGoToTheirEspnWeek() {
        JsonNode game = event("Jacksonville Jaguars at Baltimore Ravens");

        assertThat(NflSchedule.isExcluded(game)).isFalse();
        assertThat(NflSchedule.roundLabel(game)).isEqualTo("Semana 9");
    }

    @Test
    void playoffRoundsEndInTheSuperBowlEvenAfterAProBowlWeek() {
        assertThat(NflSchedule.roundLabel(event("TBD at TBD"))).isEqualTo("Ronda de comodines");
        // En la temporada 2025 la Super Bowl fue la semana 5 de los playoffs, tras la Pro Bowl.
        assertThat(NflSchedule.roundLabel(event("Seattle Seahawks at New England Patriots"))).isEqualTo("Super Bowl");
    }

    @Test
    void preseasonAndProBowlAreNotPredicted() {
        assertThat(NflSchedule.isExcluded(event("Indianapolis Colts at Baltimore Ravens"))).isTrue();
        assertThat(NflSchedule.isExcluded(event("NFC  at AFC "))).isTrue();
        assertThat(NflSchedule.roundLabel(event("NFC  at AFC "))).isNull();
    }

    @Test
    void anEventWithoutWeekKeepsItsRound() {
        JsonNode summary = new ObjectMapper().createObjectNode().put("id", "1");

        assertThat(NflSchedule.isExcluded(summary)).isFalse();
        assertThat(NflSchedule.roundLabel(summary)).isNull();
    }

    @Test
    void teamIdsGetTheNflPrefixOnce() {
        JsonNode copy = event("Jacksonville Jaguars at Baltimore Ravens").deepCopy();

        NflSchedule.namespaceTeamIds(copy);
        NflSchedule.namespaceTeamIds(copy);

        JsonNode competitor = copy.path("competitions").get(0).path("competitors").get(0);
        assertThat(competitor.path("team").path("id").asText()).isEqualTo("nfl:33");
        assertThat(competitor.path("id").asText()).isEqualTo("nfl:33");
    }

    @Test
    void recognisesItsOwnRoundLabels() {
        assertThat(NflSchedule.isRoundLabel("Semana 18")).isTrue();
        assertThat(NflSchedule.isRoundLabel("Super Bowl")).isTrue();
        assertThat(NflSchedule.isRoundLabel("Semana 2026-11-02")).isFalse();
        assertThat(NflSchedule.isRoundLabel("Jornada 3")).isFalse();
        assertThat(NflSchedule.isNfl(" NFL ")).isTrue();
        assertThat(NflSchedule.isNfl("esp.1")).isFalse();
    }
}
