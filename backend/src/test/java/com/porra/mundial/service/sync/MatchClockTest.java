package com.porra.mundial.service.sync;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import static com.porra.mundial.model.MatchStatusNormalized.FINISHED;
import static com.porra.mundial.model.MatchStatusNormalized.LIVE;
import static com.porra.mundial.model.MatchStatusNormalized.PAUSED;
import static org.assertj.core.api.Assertions.assertThat;

class MatchClockTest {

    private static final JsonMapper JSON = JsonMapper.builder().build();

    @Test
    void anNbaOrNflGameDecidedInOvertimeKeepsHowManyOvertimesItHad() {
        assertThat(MatchClock.of(competition("STATUS_FINAL", "Final/OT", "0:00", 5), FINISHED, true)).isEqualTo("OT");
        assertThat(MatchClock.of(competition("STATUS_FINAL", "Final/2OT", "0:00", 6), FINISHED, true)).isEqualTo("2OT");
        assertThat(MatchClock.of(competition("STATUS_FINAL", "Final", "0:00", 4), FINISHED, true)).isEqualTo("0:00");
    }

    @Test
    void aFootballMatchKeepsExtraTimeAndThePenaltyShootout() {
        assertThat(MatchClock.of(competition("STATUS_FINAL_AET", "AET", "120'", 4), FINISHED, false)).isEqualTo("AET");

        JsonNode shootout = read("""
                {"status": {"displayClock": "120'", "type": {"name": "STATUS_FINAL_PEN", "shortDetail": "FT-Pens"}},
                 "competitors": [{"homeAway": "home", "shootoutScore": 4}, {"homeAway": "away", "shootoutScore": "2"}]}""");
        assertThat(MatchClock.of(shootout, FINISHED, false)).isEqualTo("PEN 4-2");

        JsonNode noShootoutScore = read("""
                {"status": {"type": {"name": "STATUS_FINAL_PEN"}}, "competitors": [{"homeAway": "home"}]}""");
        assertThat(MatchClock.of(noShootoutScore, FINISHED, false)).isEqualTo("AET");
    }

    @Test
    void aLiveNbaOrNflGameSaysWhichQuarterItIsIn() {
        assertThat(MatchClock.of(competition("STATUS_IN_PROGRESS", "", "5:00", 3), LIVE, true)).isEqualTo("3.er cuarto · 5:00");
        assertThat(MatchClock.of(competition("STATUS_IN_PROGRESS", "", "2:11", 5), LIVE, true)).isEqualTo("Prórroga · 2:11");
        assertThat(MatchClock.of(competition("STATUS_HALFTIME", "", "0:00", 2), PAUSED, true)).isEqualTo("Descanso");
        // En el resto de deportes, el reloj de ESPN tal cual.
        assertThat(MatchClock.of(competition("STATUS_IN_PROGRESS", "", "67'", 2), LIVE, false)).isEqualTo("67'");
    }

    @Test
    void halftimeSaysDescansoInFootballToo() {
        assertThat(MatchClock.of(competition("STATUS_HALFTIME", "HT", "45'", 1), PAUSED, false)).isEqualTo("Descanso");
    }

    @Test
    void namesEveryQuarterAndOvertime() {
        assertThat(MatchClock.period(1)).isEqualTo("1.er cuarto");
        assertThat(MatchClock.period(2)).isEqualTo("2.º cuarto");
        assertThat(MatchClock.period(4)).isEqualTo("4.º cuarto");
        assertThat(MatchClock.period(6)).isEqualTo("2.ª prórroga");
    }

    private static JsonNode competition(String name, String shortDetail, String clock, int period) {
        return read("""
                {"status": {"displayClock": "%s", "period": %d, "type": {"name": "%s", "shortDetail": "%s"}}}"""
                .formatted(clock, period, name, shortDetail));
    }

    private static JsonNode read(String json) {
        return JSON.readTree(json);
    }
}
