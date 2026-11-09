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

    @Test
    void aCustomCompetitionKeepsItsSportAndOnlyTakesItsDrawRule() {
        League owner = League.builder().id(1L).build();
        Competition basket = Competition.builder().ownerLeague(owner).sport(Sport.BASKETBALL).build();
        Competition lol = Competition.builder().ownerLeague(owner).sport(Sport.LEAGUE_OF_LEGENDS).build();
        Competition other = Competition.builder().ownerLeague(owner).build();

        assertThat(lol.sport()).isEqualTo(Sport.LEAGUE_OF_LEGENDS);
        // Sin series ni sets del proveedor: solo se elige quién gana.
        assertThat(lol.rulesSport()).isEqualTo(Sport.BASKETBALL);
        assertThat(basket.rulesSport()).isEqualTo(Sport.BASKETBALL);
        assertThat(other.rulesSport()).isEqualTo(Sport.FOOTBALL);
        assertThat(Sport.allowsDraws(Match.builder().competition(basket).build())).isFalse();
        assertThat(Sport.allowsDraws(Match.builder().competition(other).build())).isTrue();
    }

    @Test
    void anOfficialCompetitionTakesItsSportFromItsExternalId() {
        Competition nba = Competition.builder().externalId(Competition.NBA_EXTERNAL_ID).sport(Sport.FOOTBALL).build();

        assertThat(nba.sport()).isEqualTo(Sport.BASKETBALL);
        assertThat(nba.rulesSport()).isEqualTo(Sport.BASKETBALL);
    }
}
