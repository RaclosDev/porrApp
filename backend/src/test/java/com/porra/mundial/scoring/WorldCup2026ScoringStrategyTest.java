package com.porra.mundial.scoring;

import com.porra.mundial.dto.ParticipantScoreDTO;
import com.porra.mundial.dto.PredictionDataDTO;
import com.porra.mundial.dto.TopScorerDTO;
import org.assertj.core.api.InstanceOfAssertFactories;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Reglas por defecto del Mundial 2026: 10 por pasar de grupo y 10 más por la posición exacta,
 * 25 / 30 / 40 / 60 por cada equipo acertado en 1/16, octavos, cuartos y semis, 200 campeón,
 * 150 subcampeón, 100 tercero, 75 cuarto y 200 el pichichi (repartidos si hay empate).
 */
class WorldCup2026ScoringStrategyTest {

    private static final List<String> GROUP_A = List.of("España", "Alemania", "Japón", "Costa Rica");

    private final WorldCup2026ScoringStrategy strategy = new WorldCup2026ScoringStrategy();

    /** Contexto con el grupo A ya jugado y lo demás vacío; cada test cambia lo que necesita. */
    private static final class Scenario {
        PredictionDataDTO participant = new PredictionDataDTO();
        PredictionDataDTO official = new PredictionDataDTO();
        Map<String, List<String>> standings = new HashMap<>(Map.of("A", GROUP_A));
        Map<String, Map<String, Map<String, Integer>>> officialPoints = new HashMap<>(Map.of("A", Map.of(
                "España", Map.of("mp", 3), "Alemania", Map.of("mp", 3),
                "Japón", Map.of("mp", 3), "Costa Rica", Map.of("mp", 3))));
        List<String> bestThirds = new ArrayList<>();
        List<TopScorerDTO> scorers = new ArrayList<>();
        List<String> roundOf16 = new ArrayList<>();
        List<String> quarterFinals = new ArrayList<>();
        List<String> semiFinals = new ArrayList<>();
        List<String> finalists = new ArrayList<>();
        String champion;

        ParticipantScoreDTO score(WorldCup2026ScoringStrategy strategy) {
            ParticipantScoreDTO score = ParticipantScoreDTO.builder()
                    .r1(0).r32(0).r16(0).qf(0).sf(0).finals(0).scorer(0).total(0)
                    .log(new ArrayList<>()).exactMatches(new HashMap<>()).passedTeams(new HashMap<>())
                    .build();
            strategy.evaluateScores(score, new CalculationContext(participant, official, officialPoints, standings,
                    bestThirds, scorers, roundOf16, quarterFinals, semiFinals, finalists, champion));
            return score;
        }
    }

    private static TopScorerDTO scorer(String name, String shortName, int goals) {
        return new TopScorerDTO(name, shortName, goals, "FW", null, null, null);
    }

    @Test
    void duplicateTeamsCannotMultiplyKnockoutPoints() {
        Scenario s = new Scenario();
        s.participant.setR16(java.util.Collections.nCopies(50, List.of("España", "España")));
        s.roundOf16.add("España");
        assertThat(s.score(strategy).getR32()).isEqualTo(25);
    }

    @Test
    void repeatedGroupQualifierCannotEarnPointsTwice() {
        Scenario s = new Scenario();
        s.participant.setGroups(Map.of("A", List.of("España", "España")));
        assertThat(s.score(strategy).getR1()).isEqualTo(20);
    }

    @Nested
    class GroupStage {

        @Test
        void exactFirstAndSecondEarnTwentyEach() {
            Scenario s = new Scenario();
            s.participant.setGroups(Map.of("A", GROUP_A));

            ParticipantScoreDTO score = s.score(strategy);

            assertThat(score.getR1()).isEqualTo(40);
            assertThat(score.getPassedTeams()).containsEntry("España", true).containsEntry("Alemania", true);
            assertThat(score.getExactMatches().get("A")).asInstanceOf(InstanceOfAssertFactories.MAP).containsEntry("1", true).containsEntry("2", true);
        }

        @Test
        void swappedQualifiersOnlyEarnTheQualifierPoints() {
            Scenario s = new Scenario();
            s.participant.setGroups(Map.of("A", List.of("Alemania", "España", "Japón", "Costa Rica")));

            assertThat(s.score(strategy).getR1()).isEqualTo(20);
        }

        @Test
        void aTeamThatDidNotQualifyEarnsNothing() {
            Scenario s = new Scenario();
            s.participant.setGroups(Map.of("A", List.of("Costa Rica", "Japón", "España", "Alemania")));

            ParticipantScoreDTO score = s.score(strategy);

            assertThat(score.getR1()).isZero();
            assertThat(score.getPassedTeams()).containsEntry("Costa Rica", false);
        }

        @Test
        void thirdPlaceScoresOnlyWhenPickedAsBestThirdAndItQualifies() {
            Scenario s = new Scenario();
            s.participant.setGroups(Map.of("A", GROUP_A));
            s.bestThirds = List.of("Japón");

            assertThat(s.score(strategy).getR1()).as("sin elegirlo entre los mejores terceros").isEqualTo(40);

            s.participant.setThirds(List.of("Japón"));
            assertThat(s.score(strategy).getR1()).as("elegido y clasificado en 3º exacto").isEqualTo(60);

            s.bestThirds = List.of();
            assertThat(s.score(strategy).getR1()).as("elegido pero eliminado").isEqualTo(40);
        }

        @Test
        void placeholderPositionsFallBackToTheLiveStandings() {
            Scenario s = new Scenario();
            s.participant.setGroups(Map.of("A", GROUP_A));
            s.official.setGroups(Map.of("A", List.of("1ºA", "2ºA", "3ºA", "4ºA")));

            assertThat(s.score(strategy).getR1()).isEqualTo(40);
        }
    }

    @Nested
    class Knockouts {

        @Test
        void eachRoundPaysPerTeamThatReachedTheNextOne() {
            Scenario s = new Scenario();
            s.participant.setR16(List.of(List.of("España", "Alemania"), List.of("Brasil", "Francia")));
            s.participant.setQf(List.of(List.of("España", "Brasil")));
            s.participant.setSf(List.of(List.of("España", "Francia")));
            s.participant.setFinalMatch(List.of("España", "Argentina"));
            s.roundOf16 = List.of("España", "Brasil", "Francia", "Portugal");
            s.quarterFinals = List.of("España");
            s.semiFinals = List.of("España", "Francia");
            s.finalists = List.of("España", "Inglaterra");

            ParticipantScoreDTO score = s.score(strategy);

            assertThat(score.getR32()).as("3 equipos a octavos x 25").isEqualTo(75);
            assertThat(score.getR16()).as("1 equipo a cuartos x 30").isEqualTo(30);
            assertThat(score.getQf()).as("2 equipos a semis x 40").isEqualTo(80);
            assertThat(score.getSf()).as("1 finalista x 60").isEqualTo(60);
        }

        @Test
        void unplayedRoundsScoreNothing() {
            Scenario s = new Scenario();
            s.participant.setR16(List.of(List.of("España", "Alemania")));

            ParticipantScoreDTO score = s.score(strategy);

            assertThat(score.getR32() + score.getR16() + score.getQf() + score.getSf()).isZero();
        }
    }

    @Nested
    class Finals {

        @Test
        void championAndRunnerUp() {
            Scenario s = new Scenario();
            s.participant.setFinalMatch(List.of("España", "Argentina"));
            s.participant.setChampion("España");
            s.finalists = List.of("España", "Argentina");
            s.champion = "España";

            assertThat(s.score(strategy).getFinals()).isEqualTo(200 + 150);
        }

        @Test
        void rightFinalistsWithTheWrongWinnerEarnNoFinalsPoints() {
            Scenario s = new Scenario();
            s.participant.setFinalMatch(List.of("España", "Argentina"));
            s.participant.setChampion("Argentina");
            s.finalists = List.of("España", "Argentina");
            s.champion = "España";

            assertThat(s.score(strategy).getFinals()).isZero();
        }

        @Test
        void thirdAndFourthPlace() {
            Scenario s = new Scenario();
            s.participant.setThirdPlaceMatch(List.of("Inglaterra", "Francia"));
            s.participant.setThirdPlaceWinner("Inglaterra");
            s.official.setThirdPlaceMatch(List.of("Francia", "Inglaterra"));
            s.official.setThirdPlaceWinner("Inglaterra");

            assertThat(s.score(strategy).getFinals()).isEqualTo(100 + 75);
        }
    }

    @Nested
    class TopScorer {

        private Scenario finishedTournament(String pick) {
            Scenario s = new Scenario();
            s.champion = "España";
            s.participant.setScorer(pick);
            return s;
        }

        @Test
        void matchesTheTopScorerIgnoringAccentsAndCase() {
            Scenario s = finishedTournament("kylian mbappe");
            s.scorers = List.of(scorer("Kylian Mbappé", "K. Mbappé", 8), scorer("Harry Kane", "H. Kane", 6));

            assertThat(s.score(strategy).getScorer()).isEqualTo(200);
        }

        @Test
        void tiedTopScorersSplitThePoints() {
            Scenario s = finishedTournament("Harry Kane");
            s.scorers = List.of(scorer("Kylian Mbappé", "K. Mbappé", 8), scorer("Harry Kane", "H. Kane", 8));

            assertThat(s.score(strategy).getScorer()).isEqualTo(100);
        }

        @Test
        void aPlayerBelowTheTopEarnsNothing() {
            Scenario s = finishedTournament("Harry Kane");
            s.scorers = List.of(scorer("Kylian Mbappé", "K. Mbappé", 8), scorer("Harry Kane", "H. Kane", 6));

            assertThat(s.score(strategy).getScorer()).isZero();
        }

        @Test
        void isNotAwardedBeforeThereIsAChampion() {
            Scenario s = finishedTournament("Kylian Mbappé");
            s.champion = null;
            s.scorers = List.of(scorer("Kylian Mbappé", "K. Mbappé", 8));

            assertThat(s.score(strategy).getScorer()).isZero();
        }

        @Test
        void fallsBackToTheOfficialBracketScorerList() {
            Scenario s = finishedTournament("Harry Kane");
            s.official.setScorer("Kylian Mbappé, Harry Kane");

            assertThat(s.score(strategy).getScorer()).isEqualTo(100);
        }

        /** Puntos de pichichi de {@code pick} si el máximo goleador es {@code top} y han marcado también {@code others}. */
        private int pointsFor(String pick, TopScorerDTO top, TopScorerDTO... others) {
            Scenario s = finishedTournament(pick);
            List<TopScorerDTO> scorers = new ArrayList<>();
            scorers.add(top);
            scorers.addAll(List.of(others));
            s.scorers = scorers;
            return s.score(strategy).getScorer();
        }

        private final TopScorerDTO goncaloRamos = scorer("Gonçalo Ramos", "G. Ramos", 9);
        private final TopScorerDTO mbappe = scorer("Kylian Mbappé", "K. Mbappé", 10);
        private final TopScorerDTO kane = scorer("Harry Kane", "H. Kane", 6);

        @Test
        void anotherPlayerWithTheSameSurnameIsNotTheTopScorer() {
            assertThat(pointsFor("Sergio Ramos", goncaloRamos, kane)).isZero();
            assertThat(pointsFor("S. Ramos", goncaloRamos, kane)).isZero();
        }

        @Test
        void theSurnameAloneCountsWhenNoOtherScorerHasIt() {
            assertThat(pointsFor("Ramos", goncaloRamos, kane)).isEqualTo(200);
        }

        @Test
        void theSurnameAloneDoesNotCountWhenItIsAmbiguous() {
            assertThat(pointsFor("Ramos", goncaloRamos, scorer("Sergio Ramos", "S. Ramos", 1))).isZero();
            assertThat(pointsFor("Martínez", scorer("Lautaro Martínez", "L. Martínez", 8),
                    scorer("Lisandro Martínez", "L. Martínez", 1))).isZero();
        }

        @Test
        void aSharedShortNameIsAmbiguousButTheFullNameIsNot() {
            TopScorerDTO lautaro = scorer("Lautaro Martínez", "L. Martínez", 8);
            TopScorerDTO lisandro = scorer("Lisandro Martínez", "L. Martínez", 1);

            assertThat(pointsFor("L. Martinez", lautaro, lisandro)).isZero();
            assertThat(pointsFor("Lautaro Martinez", lautaro, lisandro)).isEqualTo(200);
            assertThat(pointsFor("Lisandro Martinez", lautaro, lisandro)).isZero();
        }

        @Test
        void acceptsTheInitialAndSurnameForm() {
            assertThat(pointsFor("K. Mbappe", mbappe, kane)).isEqualTo(200);
            assertThat(pointsFor("k mbappé", mbappe, kane)).isEqualTo(200);
            assertThat(pointsFor("E. Mbappé", mbappe, kane)).as("otra inicial es otro jugador").isZero();
        }

        @Test
        void acceptsSmallTyposButNotADifferentName() {
            assertThat(pointsFor("Kilian Mbape", mbappe, kane)).isEqualTo(200);
            assertThat(pointsFor("Mbape", mbappe, kane)).isEqualTo(200);
            assertThat(pointsFor("K. Mbape", mbappe, kane)).isEqualTo(200);
            assertThat(pointsFor("Rapinha", scorer("Raphinha", "Raphinha", 7), kane)).isEqualTo(200);
            assertThat(pointsFor("Kanté", scorer("Harry Kane", "H. Kane", 12), mbappe)).as("apellido corto, sin erratas").isZero();
            assertThat(pointsFor("Kylian", mbappe, kane)).as("el nombre de pila solo no basta").isZero();
        }

        @Test
        void acceptsPunctuationAndJuniorVariants() {
            assertThat(pointsFor("Vinicius Jr.", scorer("Vinícius Júnior", "V. Júnior", 8), kane)).isEqualTo(200);
            assertThat(pointsFor("  KYLIAN   MBAPPÉ ", mbappe, kane)).isEqualTo(200);
        }

        @Test
        void aTypoCloserToAnotherScorerIsNotTheTopScorer() {
            assertThat(pointsFor("Luis Suares", scorer("Luis Juárez", "L. Juárez", 8), scorer("Luis Suárez", "L. Suárez", 1)))
                    .isZero();
        }
    }

    @Test
    void usesTheLeagueRulesInsteadOfTheDefaults() {
        ScoringRuleSet rules = ScoringRuleSet.builder().championPoints(500).groupExactPositionPoints(0).build();
        Scenario s = new Scenario();
        s.participant.setGroups(Map.of("A", GROUP_A));
        s.participant.setChampion("España");
        s.champion = "España";

        ParticipantScoreDTO score = s.score(new WorldCup2026ScoringStrategy(rules));

        assertThat(score.getR1()).as("solo los 10 por pasar").isEqualTo(20);
        assertThat(score.getFinals()).isEqualTo(500);
    }

    @Test
    void everyAwardIsLoggedWithItsStage() {
        Scenario s = new Scenario();
        s.participant.setGroups(Map.of("A", GROUP_A));
        s.participant.setChampion("España");
        s.champion = "España";

        ParticipantScoreDTO score = s.score(strategy);

        assertThat(score.getLog()).extracting(ParticipantScoreDTO.LogEntry::getStage).containsOnly("r1", "finals");
        assertThat(score.getLog().stream().mapToInt(ParticipantScoreDTO.LogEntry::getAmount).sum())
                .isEqualTo(score.getR1() + score.getFinals());
    }
}
