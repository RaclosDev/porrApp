package com.porra.mundial.model;

import com.porra.mundial.sports.TennisTournaments;
import com.porra.mundial.util.MatchRound;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class TennisScopeTest {

    @Test
    void grandSlamsAreTheFourMajorsWithBothDraws() {
        assertThat(TennisTournaments.externalIds(TennisScope.GRAND_SLAMS, TennisTour.BOTH)).containsExactly(
                "tennis.atp.154", "tennis.wta.154", "tennis.atp.172", "tennis.wta.172",
                "tennis.atp.188", "tennis.wta.188", "tennis.atp.189", "tennis.wta.189");
        assertThat(TennisTournaments.externalIds(TennisScope.GRAND_SLAMS, TennisTour.WTA))
                .containsExactly("tennis.wta.154", "tennis.wta.172", "tennis.wta.188", "tennis.wta.189");
    }

    @Test
    void mastersIncludeTheAtpFinalsAndNoMajor() {
        var masters = TennisTournaments.externalIds(TennisScope.MASTERS_1000, TennisTour.ATP);
        assertThat(masters).contains("tennis.atp.42", "tennis.atp.13", "tennis.atp.339")
                .doesNotContain("tennis.atp.172").allMatch(id -> id.startsWith("tennis.atp."));
        // Los cuadros femeninos solo están en los torneos mixtos: ni Montecarlo ni las Finals.
        assertThat(TennisTournaments.externalIds(TennisScope.MASTERS_1000, TennisTour.WTA))
                .doesNotContain("tennis.wta.42", "tennis.wta.339").contains("tennis.wta.413");
    }

    @Test
    void everyTournamentIsInTheWholeSeason() {
        assertThat(TennisTournaments.externalIds(TennisScope.ALL, TennisTour.ATP)).hasSize(TennisTournaments.ALL.size());
    }

    @Test
    void aMultiTournamentLeagueGroupsByTournamentYearAndRound() {
        Competition women = Competition.builder().id(2L).externalId("tennis.wta.172").build();
        Match match = Match.builder().competition(women).round("r16")
                .matchDate(Instant.parse("2027-06-01T12:00:00Z")).build();
        Edition scoped = Edition.builder().tennisScope(TennisScope.GRAND_SLAMS).tennisTour(TennisTour.BOTH)
                .multiCompetition(true).build();
        assertThat(MatchRound.label(scoped, match)).isEqualTo("Roland Garros 2027 · Octavos de final");
        // Una liga de un torneo (con sus dos cuadros) sigue con la ronda sola.
        assertThat(MatchRound.label(Edition.builder().multiCompetition(true).build(), match))
                .isEqualTo("Octavos de final");
    }
}
