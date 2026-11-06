package com.porra.mundial.service.prediction;

import com.porra.mundial.model.Competition;
import com.porra.mundial.model.Edition;
import com.porra.mundial.model.League;
import com.porra.mundial.model.Match;
import com.porra.mundial.model.PoolFormat;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class PredictableBracketTest {

    private static final Competition CUSTOM = Competition.builder().id(1L)
            .ownerLeague(League.builder().id(7L).build()).build();
    private static final Competition CHAMPIONS = Competition.builder().id(2L)
            .formatType("TOURNAMENT").externalId("uefa.champions").build();
    private static final Competition WORLD_CUP = Competition.builder().id(3L)
            .formatType("TOURNAMENT").externalId(Competition.WORLD_CUP_EXTERNAL_ID).build();

    @Test
    void appliesToOwnBracketsButNotToMatchdaysOrTheWorldCup() {
        assertThat(PredictableBracket.applies(edition(CUSTOM, PoolFormat.KNOCKOUTS_ONLY))).isTrue();
        assertThat(PredictableBracket.applies(edition(CHAMPIONS, PoolFormat.KNOCKOUTS_ONLY))).isTrue();
        assertThat(PredictableBracket.applies(edition(WORLD_CUP, PoolFormat.FULL_BRACKET))).isFalse();
        assertThat(PredictableBracket.applies(edition(CUSTOM, PoolFormat.MATCH_DAY))).isFalse();
        assertThat(PredictableBracket.applies(null)).isFalse();
    }

    @Test
    void customRoundsKeepTheirNumberEvenWhenOneIsEmpty() {
        Match first = match(11L, "bracket-1", null);
        Match second = match(10L, "bracket-1", null);
        Match last = match(12L, "bracket-3", null);
        Match ignored = match(13L, "group", null);

        List<List<Match>> rounds = PredictableBracket.rounds(CUSTOM, List.of(first, last, ignored, second));

        assertThat(rounds).containsExactly(List.of(second, first), List.of(), List.of(last));
    }

    @Test
    void officialRoundsStartAtTheFirstOneWithMatchesOrderedByDate() {
        Match late = match(1L, "r16", Instant.parse("2026-03-11T20:00:00Z"));
        Match early = match(2L, "r16", Instant.parse("2026-03-10T20:00:00Z"));
        Match finalMatch = match(3L, "final", Instant.parse("2026-05-30T19:00:00Z"));

        List<List<Match>> rounds = PredictableBracket.rounds(CHAMPIONS, List.of(late, finalMatch, early));

        assertThat(rounds).containsExactly(List.of(early, late), List.of(), List.of(), List.of(finalMatch));
    }

    private static Edition edition(Competition competition, PoolFormat format) {
        return Edition.builder().competition(competition).poolFormat(format).build();
    }

    private static Match match(Long id, String round, Instant date) {
        Match match = Match.builder().round(round).matchDate(date).build();
        match.setId(id);
        return match;
    }
}
