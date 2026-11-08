package com.porra.mundial.model;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class EventSeriesTest {

    @Test
    void numberedEventsStartWithTheirNumber() {
        assertThat(EventSeries.of("UFC 334: Gane vs. Hokit")).isEqualTo(EventSeries.NUMBERED);
        assertThat(EventSeries.of("ufc 300")).isEqualTo(EventSeries.NUMBERED);
    }

    @Test
    void everyOtherEventIsAFightNight() {
        assertThat(EventSeries.of("UFC Fight Night: Moicano vs. Nolan")).isEqualTo(EventSeries.FIGHT_NIGHT);
        assertThat(EventSeries.of("Noche UFC: Moicano vs. Nolan")).isEqualTo(EventSeries.FIGHT_NIGHT);
        assertThat(EventSeries.of("UFC on ABC 9")).isEqualTo(EventSeries.FIGHT_NIGHT);
        assertThat(EventSeries.of(null)).isNull();
    }

    @Test
    void noSeriesIncludesEveryEvent() {
        assertThat(EventSeries.includes(null, "UFC Fight Night: X")).isTrue();
        assertThat(EventSeries.includes(EventSeries.NUMBERED, "UFC Fight Night: X")).isFalse();
        assertThat(EventSeries.includes(EventSeries.FIGHT_NIGHT, "UFC Fight Night: X")).isTrue();
        assertThat(EventSeries.includes(EventSeries.FIGHT_NIGHT, null)).isFalse();
    }
}
