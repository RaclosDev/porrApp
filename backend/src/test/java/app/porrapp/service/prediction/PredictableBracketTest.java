package app.porrapp.service.prediction;

import app.porrapp.model.Competition;
import app.porrapp.model.Edition;
import app.porrapp.model.League;
import app.porrapp.model.Match;
import app.porrapp.model.PoolFormat;
import app.porrapp.model.Team;
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

    private static final Competition WORLDS = Competition.builder().id(4L)
            .externalId("lol.worlds").formatType("TOURNAMENT").build();

    private static Match decided(Long id, String round, Instant date) {
        Match match = match(id, round, date);
        match.setHomeTeam(Team.builder().id(id * 10).name("A" + id).build());
        match.setAwayTeam(Team.builder().id(id * 10 + 1).name("B" + id).build());
        return match;
    }

    @Test
    void bracketPredictionsCloseAtTheFirstKnockoutWithBothTeams() {
        Instant swiss = Instant.parse("2026-10-20T10:00:00Z");
        Instant firstQuarter = Instant.parse("2026-10-29T08:00:00Z");
        Match group = decided(1L, "group", swiss);
        group.setGroupName("1-0");
        List<Match> all = List.of(group, match(2L, "qf", Instant.parse("2026-10-28T08:00:00Z")),
                decided(3L, "qf", firstQuarter), decided(4L, "sf", Instant.parse("2026-11-01T08:00:00Z")));

        assertThat(PredictableBracket.predictionsCloseAt(WORLDS, PoolFormat.KNOCKOUTS_ONLY, all))
                .as("un cruce sin rival aún no cierra nada").isEqualTo(firstQuarter);
        assertThat(PredictableBracket.predictionsCloseAt(WORLDS, PoolFormat.FULL_BRACKET, all))
                .as("el cuadro completo también pronostica los grupos").isEqualTo(swiss);
        assertThat(PredictableBracket.predictionsCloseAt(WORLDS, PoolFormat.MATCH_DAY, all)).isNull();
        assertThat(PredictableBracket.predictionsCloseAt(CHAMPIONS, PoolFormat.KNOCKOUTS_ONLY, all))
                .as("con cruces sorteados se puede entrar tarde").isNull();
        assertThat(PredictableBracket.predictionsCloseAt(WORLD_CUP, PoolFormat.KNOCKOUTS_ONLY, all)).isNull();
        assertThat(PredictableBracket.predictionsCloseAt(WORLDS, PoolFormat.KNOCKOUTS_ONLY,
                List.of(match(5L, "qf", firstQuarter)))).isNull();
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
