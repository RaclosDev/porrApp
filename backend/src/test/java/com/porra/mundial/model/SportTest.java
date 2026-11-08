package com.porra.mundial.model;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class SportTest {

    @Test
    void onlyFootballMatchesCanEndInADraw() {
        assertThat(Sport.FOOTBALL.allowsDraws()).isTrue();
        // Una serie del LoL o un partido de la NBA siempre los gana alguien; en la NFL el empate es rarísimo.
        assertThat(Sport.LEAGUE_OF_LEGENDS.allowsDraws()).isFalse();
        assertThat(Sport.BASKETBALL.allowsDraws()).isFalse();
        assertThat(Sport.AMERICAN_FOOTBALL.allowsDraws()).isFalse();
        assertThat(Sport.TENNIS.allowsDraws()).isFalse();
        assertThat(Sport.MMA.allowsDraws()).isFalse();
    }
}
