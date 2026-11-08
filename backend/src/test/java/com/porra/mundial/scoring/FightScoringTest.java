package com.porra.mundial.scoring;

import com.porra.mundial.model.Fight;
import com.porra.mundial.model.FightMethod;
import com.porra.mundial.model.Match;
import com.porra.mundial.model.Team;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.junit.jupiter.api.Assertions.*;

class FightScoringTest {

    private final Team red = Team.builder().id(1L).name("Renato Moicano").build();
    private final Team blue = Team.builder().id(2L).name("Tom Nolan").build();
    private final ScoringRuleSet rules = ScoringRuleSet.builder().build();

    private Match finished(Team winner) {
        return Match.builder().id(10L).homeTeam(red).awayTeam(blue).winnerTeam(winner).finished(true).build();
    }

    private static Fight fight(FightMethod method, Integer round) {
        return Fight.builder().matchId(10L).resultMethod(method).resultRound(round).scheduledRounds(5).build();
    }

    @ParameterizedTest(name = "{0} {1} R{2} → {3} pts")
    @CsvSource({
            // Elección, método, asalto, puntos, pleno
            "2, , , 3, false",
            "2, KO_TKO, , 5, false",
            "2, KO_TKO, 3, 7, true",
            "2, KO_TKO, 2, 5, false",
            "2, SUBMISSION, 3, 3, false",
            "2, DECISION, , 3, false",
            "1, KO_TKO, 3, 0, false",
    })
    void winnerMethodAndRoundAddUp(String sign, String method, Integer round, int points, boolean full) {
        MatchScoreResult result = FightScoring.score(sign, method, round, finished(blue), fight(FightMethod.KO_TKO, 3), rules);

        assertEquals(points, result.totalPoints());
        assertEquals(full, result.exactScore());
        assertEquals(points > 0, result.correctSign());
    }

    @Test
    void aDecisionIsAFullHitWithoutRound() {
        MatchScoreResult result = FightScoring.score("1", "DECISION", null, finished(red), fight(FightMethod.DECISION, 3), rules);

        assertEquals(5, result.totalPoints());
        assertTrue(result.exactScore());
        assertEquals("Ganador +3 · Método +2 (5 pts)", result.explanation());
    }

    @Test
    void drawsAndNoContestsScoreNothing() {
        assertEquals(0, FightScoring.score("1", "DECISION", null, finished(null), fight(FightMethod.DRAW, 3), rules).totalPoints());
        MatchScoreResult noContest = FightScoring.score("2", null, null, finished(null), fight(FightMethod.NO_CONTEST, 2), rules);
        assertEquals(0, noContest.totalPoints());
        assertEquals("Sin resultado: no puntúa", noContest.explanation());
    }

    @Test
    void aDisqualificationOnlyPaysTheWinner() {
        MatchScoreResult result = FightScoring.score("2", "KO_TKO", 2, finished(blue), fight(FightMethod.DISQUALIFICATION, 2), rules);
        assertEquals(3, result.totalPoints());
    }

    @Test
    void anUnfinishedFightHasNoScoreYet() {
        Match live = Match.builder().homeTeam(red).awayTeam(blue).finished(false).build();
        assertNull(FightScoring.score("1", null, null, live, fight(null, null), rules));
    }

    @Test
    void adminRulesChangeThePoints() {
        ScoringRuleSet custom = ScoringRuleSet.builder().fightWinnerPoints(10).fightMethodPoints(5).fightRoundPoints(0).build();
        assertEquals(15, FightScoring.score("2", "KO_TKO", 3, finished(blue), fight(FightMethod.KO_TKO, 3), custom).totalPoints());
    }

    @Test
    void espnResultNamesMapToMethods() {
        assertEquals(FightMethod.KO_TKO, FightMethod.fromEspn("kotko"));
        assertEquals(FightMethod.KO_TKO, FightMethod.fromEspn("tko---doctors-stoppage"));
        assertEquals(FightMethod.SUBMISSION, FightMethod.fromEspn("submission"));
        assertEquals(FightMethod.DECISION, FightMethod.fromEspn("decision---split"));
        assertEquals(FightMethod.DRAW, FightMethod.fromEspn("draw"));
        assertEquals(FightMethod.NO_CONTEST, FightMethod.fromEspn("no-contest"));
        assertEquals(FightMethod.DISQUALIFICATION, FightMethod.fromEspn("dq"));
        assertNull(FightMethod.fromEspn(null));
        assertNull(FightMethod.predicted("DRAW"));
        assertEquals(FightMethod.SUBMISSION, FightMethod.predicted("submission"));
    }
}
