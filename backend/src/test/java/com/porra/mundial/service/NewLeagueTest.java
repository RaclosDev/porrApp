package com.porra.mundial.service;

import com.porra.mundial.model.PoolFormat;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class NewLeagueTest {

    @Test
    void scorerPointsAreOnUnlessTurnedOff() {
        NewLeague league = NewLeague.of("Liga", "admin@test.com", 1L, PoolFormat.FULL_BRACKET);

        assertThat(league.countsScorers()).isTrue();
        assertThat(league.withPichichi(false).countsScorers()).isFalse();
        assertThat(new NewLeague("Liga", "admin@test.com", 1L, PoolFormat.FULL_BRACKET, null, null, null)
                .countsScorers()).isTrue();
    }

    @Test
    void customLeaguesCarryTheirCompetitionNameAndNoCompetitionId() {
        NewLeague league = NewLeague.custom("Liga", "admin@test.com", "Copa del barrio", PoolFormat.MATCH_DAY)
                .withCreationKey("clave");

        assertThat(league.competitionId()).isNull();
        assertThat(league.customCompetitionName()).isEqualTo("Copa del barrio");
        assertThat(league.creationKey()).isEqualTo("clave");
    }
}
