package app.porrapp.service.tournament;

import app.porrapp.model.GroupStanding;
import app.porrapp.model.GroupTiebreak;
import app.porrapp.model.Match;
import app.porrapp.model.Team;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Criterios del artículo 13 del reglamento de la Copa Mundial de la FIFA 26 y del artículo 20 del de la
 * Eurocopa 2022-24. Cada caso calcula la clasificación con los mismos partidos que recibe el desempate,
 * así que los datos son coherentes. Los casos con nombres de selecciones son empates que se dieron de
 * verdad, con sus marcadores.
 */
class GroupTiebreakerTest {

    private final Map<String, Team> teams = new LinkedHashMap<>();
    private final List<Match> matches = new ArrayList<>();
    private final Map<String, Integer> fairPlay = new LinkedHashMap<>();

    private Team team(String name) {
        return teams.computeIfAbsent(name, n -> Team.builder().id((long) teams.size() + 1).name(n).build());
    }

    private void play(String home, int homeGoals, int awayGoals, String away) {
        matches.add(Match.builder().round("group").homeTeam(team(home)).awayTeam(team(away))
                .homeScore(homeGoals).awayScore(awayGoals).finished(true).build());
    }

    /** Los equipos pedidos, del mejor al peor tercero según el reglamento. */
    private List<String> thirds(GroupTiebreak tiebreak, String... names) {
        List<String> wanted = List.of(names);
        List<GroupStanding> thirds = new ArrayList<>(standings().stream()
                .filter(gs -> wanted.contains(gs.getTeam().getName())).toList());
        thirds.sort(GroupTiebreaker.thirdPlaceOrder(tiebreak, matches));
        return names(thirds);
    }

    private List<GroupStanding> standings() {
        Map<String, GroupStanding> table = new LinkedHashMap<>();
        teams.forEach((name, t) -> table.put(name, GroupStanding.builder().team(t)
                .points(0).goalDiff(0).goalsFor(0).fairPlayPoints(fairPlay.getOrDefault(name, 0)).build()));
        for (Match m : matches) {
            add(table.get(m.getHomeTeam().getName()), m.getHomeScore(), m.getAwayScore());
            add(table.get(m.getAwayTeam().getName()), m.getAwayScore(), m.getHomeScore());
        }
        return new ArrayList<>(table.values());
    }

    private static void add(GroupStanding gs, int scored, int conceded) {
        gs.setPoints(gs.getPoints() + (scored > conceded ? 3 : scored == conceded ? 1 : 0));
        gs.setGoalDiff(gs.getGoalDiff() + scored - conceded);
        gs.setGoalsFor(gs.getGoalsFor() + scored);
    }

    private List<String> ranking() {
        return names(GroupTiebreaker.sort(standings(), matches));
    }

    private static List<String> names(List<GroupStanding> standings) {
        return standings.stream().map(gs -> gs.getTeam().getName()).toList();
    }

    @Test
    void headToHeadPointsComeBeforeTheOverallGoalDifference() {
        // A y B con 6 puntos. B: +7 en total; A: -1, pero le ganó a B.
        play("A", 1, 0, "B");
        play("A", 0, 3, "C");
        play("A", 1, 0, "D");
        play("B", 4, 0, "C");
        play("B", 4, 0, "D");
        play("C", 0, 0, "D");

        assertThat(ranking()).containsExactly("A", "B", "C", "D");
    }

    @Test
    void headToHeadGoalDifferenceBreaksAThreeWayTie() {
        // Ciclo A>B>C>A: 3 puntos cada uno entre ellos; diferencia en esos partidos A +1, C 0, B -1.
        play("A", 2, 0, "B");
        play("B", 1, 0, "C");
        play("C", 1, 0, "A");
        // En total B es el de mejor diferencia (+4) y C el peor (+1).
        play("A", 1, 0, "D");
        play("B", 5, 0, "D");
        play("C", 1, 0, "D");

        assertThat(ranking()).containsExactly("A", "C", "B", "D");
    }

    @Test
    void headToHeadGoalsScoredBreakAThreeWayTie() {
        // Entre ellos: 3 puntos y diferencia 0 para los tres; goles B 4, C 3, A 2.
        play("A", 2, 1, "B");
        play("B", 3, 2, "C");
        play("C", 1, 0, "A");
        // En total A es el de mejor diferencia (+4).
        play("A", 4, 0, "D");
        play("B", 1, 0, "D");
        play("C", 1, 0, "D");

        assertThat(ranking()).containsExactly("B", "C", "A", "D");
    }

    @Test
    void theHeadToHeadIsReappliedToTheTeamsStillLevel() {
        // Mini-liga de tres: A sale primero por goles (3); B y C quedan igualados (3 pts, 0, 2 goles)
        // y se repite solo con su partido: B 1-0 C, aunque C tenga mejor diferencia total.
        play("A", 2, 1, "B");
        play("C", 2, 1, "A");
        play("B", 1, 0, "C");
        play("A", 1, 0, "D");
        play("B", 1, 0, "D");
        play("C", 5, 0, "D");

        assertThat(ranking()).containsExactly("A", "B", "C", "D");
    }

    @Test
    void overallGoalDifferenceDecidesWhenTheHeadToHeadIsLevel() {
        // A y B con 4 puntos, empataron entre ellos; A +2 y B 0 en total.
        play("A", 1, 1, "B");
        play("A", 3, 0, "C");
        play("B", 1, 0, "C");
        play("A", 0, 1, "D");
        play("B", 0, 1, "D");
        play("C", 0, 0, "D");

        assertThat(ranking()).containsExactly("D", "A", "B", "C");
    }

    @Test
    void overallGoalsScoredComeAfterTheOverallGoalDifference() {
        // A y B con 4 puntos, 2-2 entre ellos y +1 en total; A ha marcado 5 y B 4.
        play("A", 2, 2, "B");
        play("A", 3, 1, "C");
        play("B", 2, 0, "C");
        play("A", 0, 1, "D");
        play("B", 0, 1, "D");
        play("C", 1, 0, "D");

        assertThat(ranking()).containsExactly("D", "A", "B", "C");
    }

    @Test
    void fairPlayComesAfterTheGoals() {
        // A y B: 4 puntos, +1 y 2 goles; A con más tarjetas.
        play("A", 1, 1, "B");
        play("A", 1, 0, "C");
        play("B", 1, 0, "C");
        fairPlay.put("A", -5);
        fairPlay.put("B", -2);

        assertThat(ranking()).containsExactly("B", "A", "C");
    }

    @Test
    void theSecondStepDoesNotRestartTheHeadToHead() {
        // Ciclo X>Y>Z>X a 1-0: el directo no separa a nadie. X sale primero por diferencia de goles;
        // Y y Z siguen iguales en diferencia y goles y decide el fair play, aunque Y le ganó a Z.
        play("X", 1, 0, "Y");
        play("Y", 1, 0, "Z");
        play("Z", 1, 0, "X");
        play("X", 3, 0, "D");
        play("Y", 1, 0, "D");
        play("Z", 1, 0, "D");
        fairPlay.put("Y", -3);
        fairPlay.put("Z", -1);

        assertThat(ranking()).containsExactly("X", "Z", "Y", "D");
    }

    @Test
    void teamsOnlyTheFifaRankingWouldSeparateShareATierSortedByName() {
        play("B", 1, 1, "A");

        assertThat(GroupTiebreaker.tiers(standings(), matches)).hasSize(1);
        assertThat(ranking()).containsExactly("A", "B");
    }

    @Test
    void unfinishedMatchesDoNotCountForTheHeadToHead() {
        play("A", 1, 1, "B");
        List<GroupStanding> table = standings();
        table.get(0).setGoalDiff(5);
        List<Match> withLiveMatch = new ArrayList<>(matches);
        withLiveMatch.add(Match.builder().homeTeam(team("B")).awayTeam(team("A"))
                .homeScore(3).awayScore(0).finished(false).build());

        // Si contara el partido en juego, B ganaría el directo; sin él decide la diferencia de goles de A.
        assertThat(names(GroupTiebreaker.sort(table, withLiveMatch))).containsExactly("A", "B");
    }

    @Test
    void bestThirdsGoByPointsGoalDifferenceGoalsAndThenFairPlay() {
        GroupStanding morePoints = GroupStanding.builder().team(team("Más puntos")).points(6).goalDiff(-3).goalsFor(1).build();
        GroupStanding betterDiff = GroupStanding.builder().team(team("Mejor diferencia")).points(4).goalDiff(1).goalsFor(4).build();
        GroupStanding moreGoals = GroupStanding.builder().team(team("Más goles")).points(4).goalDiff(0).goalsFor(7).fairPlayPoints(-9).build();
        GroupStanding cleaner = GroupStanding.builder().team(team("Menos tarjetas")).points(4).goalDiff(0).goalsFor(2).fairPlayPoints(-3).build();
        GroupStanding dirtier = GroupStanding.builder().team(team("Más tarjetas")).points(4).goalDiff(0).goalsFor(2).fairPlayPoints(-5).build();

        List<GroupStanding> thirds = new ArrayList<>(List.of(dirtier, cleaner, moreGoals, betterDiff, morePoints));
        thirds.sort(GroupTiebreaker.thirdPlaceOrder(GroupTiebreak.FIFA, List.of()));

        assertThat(thirds).containsExactly(morePoints, betterDiff, moreGoals, cleaner, dirtier);
    }

    @Test
    void worldCup2018GroupHJapanGoesThroughOnFairPlay() {
        play("Colombia", 1, 2, "Japón");
        play("Polonia", 1, 2, "Senegal");
        play("Japón", 2, 2, "Senegal");
        play("Polonia", 0, 3, "Colombia");
        play("Japón", 0, 1, "Polonia");
        play("Senegal", 0, 1, "Colombia");
        // Japón y Senegal: 4 puntos, 2-2 entre ellos y 4-4 en total. Japón vio menos tarjetas.
        fairPlay.put("Japón", -4);
        fairPlay.put("Senegal", -6);

        assertThat(ranking()).containsExactly("Colombia", "Japón", "Senegal", "Polonia");
    }

    @Test
    void worldCup2022GroupHSouthKoreaGoesThroughOnGoalsScored() {
        play("Uruguay", 0, 0, "Corea del Sur");
        play("Portugal", 3, 2, "Ghana");
        play("Corea del Sur", 2, 3, "Ghana");
        play("Portugal", 2, 0, "Uruguay");
        play("Ghana", 0, 2, "Uruguay");
        play("Corea del Sur", 2, 1, "Portugal");

        // Corea y Uruguay: 4 puntos, 0-0 entre ellos y diferencia 0; Corea marcó 4 y Uruguay 2.
        assertThat(ranking()).containsExactly("Portugal", "Corea del Sur", "Uruguay", "Ghana");
    }

    @Test
    void worldCup1994BestThirdsGoByPointsGoalDifferenceAndGoalsScored() {
        play("Estados Unidos", 1, 1, "Suiza");
        play("Colombia", 1, 2, "Estados Unidos");
        play("Estados Unidos", 0, 1, "Rumanía");
        play("Camerún", 0, 3, "Brasil");
        play("Brasil", 2, 0, "Rusia");
        play("Suecia", 3, 1, "Rusia");
        play("Rusia", 6, 1, "Camerún");
        play("España", 2, 2, "Corea del Sur");
        play("Corea del Sur", 0, 0, "Bolivia");
        play("Alemania", 3, 2, "Corea del Sur");
        play("Argentina", 4, 0, "Grecia");
        play("Argentina", 2, 1, "Nigeria");
        play("Argentina", 0, 2, "Bulgaria");
        play("Italia", 0, 1, "Irlanda");
        play("Italia", 1, 0, "Noruega");
        play("Italia", 1, 1, "México");
        play("Bélgica", 1, 0, "Marruecos");
        play("Bélgica", 1, 0, "Países Bajos");
        play("Bélgica", 0, 1, "Arabia Saudí");

        // Argentina y Bélgica con 6 puntos: +3 y +1. Estados Unidos e Italia con 4 y diferencia 0: 3 goles y 2.
        assertThat(thirds(GroupTiebreak.FIFA, "Corea del Sur", "Italia", "Rusia", "Bélgica", "Estados Unidos", "Argentina"))
                .containsExactly("Argentina", "Bélgica", "Estados Unidos", "Italia", "Rusia", "Corea del Sur");
    }

    @Test
    void euro2012GroupAGreeceGoesThroughOnItsWinOverRussia() {
        play("Polonia", 1, 1, "Grecia");
        play("Rusia", 4, 1, "República Checa");
        play("Grecia", 1, 2, "República Checa");
        play("Polonia", 1, 1, "Rusia");
        play("República Checa", 1, 0, "Polonia");
        play("Grecia", 1, 0, "Rusia");

        // Grecia y Rusia con 4 puntos: Rusia +2 en total y Grecia 0, pero Grecia ganó el partido entre ellas.
        assertThat(ranking()).containsExactly("República Checa", "Grecia", "Rusia", "Polonia");
    }

    @Test
    void euro2024GroupETheFourTeamsFinishLevelOnPoints() {
        play("Rumanía", 3, 0, "Ucrania");
        play("Bélgica", 0, 1, "Eslovaquia");
        play("Eslovaquia", 1, 2, "Ucrania");
        play("Bélgica", 2, 0, "Rumanía");
        play("Eslovaquia", 1, 1, "Rumanía");
        play("Ucrania", 0, 0, "Bélgica");

        // Los cuatro con 4 puntos: Rumanía y Bélgica +1 (4 goles y 2), Eslovaquia 0 y Ucrania -2.
        assertThat(ranking()).containsExactly("Rumanía", "Bélgica", "Eslovaquia", "Ucrania");
    }

    @Test
    void euro2024GroupCDenmarkGoesThroughOnDisciplinaryPoints() {
        play("Eslovenia", 1, 1, "Dinamarca");
        play("Serbia", 0, 1, "Inglaterra");
        play("Eslovenia", 1, 1, "Serbia");
        play("Dinamarca", 1, 1, "Inglaterra");
        play("Inglaterra", 0, 0, "Eslovenia");
        play("Dinamarca", 0, 0, "Serbia");
        // Dinamarca y Eslovenia: tres empates cada una, 1-1 entre ellas y 2-2 en total.
        fairPlay.put("Dinamarca", -6);
        fairPlay.put("Eslovenia", -7);

        assertThat(ranking()).containsExactly("Inglaterra", "Dinamarca", "Eslovenia", "Serbia");
    }

    @Test
    void euro2024BestThirdsNetherlandsLeadGeorgiaOnDisciplinaryPoints() {
        play("Polonia", 1, 2, "Países Bajos");
        play("Países Bajos", 0, 0, "Francia");
        play("Países Bajos", 2, 3, "Austria");
        play("Turquía", 3, 1, "Georgia");
        play("Georgia", 1, 1, "Chequia");
        play("Georgia", 2, 0, "Portugal");
        play("Bélgica", 0, 1, "Eslovaquia");
        play("Eslovaquia", 1, 2, "Ucrania");
        play("Eslovaquia", 1, 1, "Rumanía");
        play("Eslovenia", 1, 1, "Dinamarca");
        play("Eslovenia", 1, 1, "Serbia");
        play("Inglaterra", 0, 0, "Eslovenia");
        play("Hungría", 1, 3, "Suiza");
        play("Alemania", 2, 0, "Hungría");
        play("Escocia", 0, 1, "Hungría");
        play("España", 3, 0, "Croacia");
        play("Croacia", 2, 2, "Albania");
        play("Croacia", 1, 1, "Italia");
        // Países Bajos y Georgia: 4 puntos, 4-4 y una victoria cada una. Deciden las tarjetas.
        fairPlay.put("Países Bajos", -2);
        fairPlay.put("Georgia", -6);

        assertThat(thirds(GroupTiebreak.UEFA, "Croacia", "Hungría", "Eslovenia", "Eslovaquia", "Georgia", "Países Bajos"))
                .containsExactly("Países Bajos", "Georgia", "Eslovaquia", "Eslovenia", "Hungría", "Croacia");
    }

    @Test
    void uefaRanksThirdsByWinsBeforeCardsAndFifaDoesNot() {
        // Caso construido: dos terceros con 3 puntos y 2-2. Uno ganó un partido y vio más tarjetas;
        // el otro empató los tres.
        play("Una victoria", 2, 0, "A1");
        play("A2", 1, 0, "Una victoria");
        play("A3", 1, 0, "Una victoria");
        play("Tres empates", 1, 1, "B1");
        play("Tres empates", 1, 1, "B2");
        play("Tres empates", 0, 0, "B3");
        fairPlay.put("Una victoria", -5);
        fairPlay.put("Tres empates", -1);

        assertThat(thirds(GroupTiebreak.UEFA, "Tres empates", "Una victoria"))
                .containsExactly("Una victoria", "Tres empates");
        assertThat(thirds(GroupTiebreak.FIFA, "Tres empates", "Una victoria"))
                .containsExactly("Tres empates", "Una victoria");
    }

    @Test
    void onlyFinishedGroupMatchesCountAsWinsAmongThirds() {
        play("Una victoria", 2, 0, "A1");
        play("A2", 1, 0, "Una victoria");
        play("A3", 1, 0, "Una victoria");
        play("Tres empates", 1, 1, "B1");
        play("Tres empates", 1, 1, "B2");
        play("Tres empates", 0, 0, "B3");
        List<GroupStanding> thirds = new ArrayList<>(standings().stream()
                .filter(gs -> List.of("Una victoria", "Tres empates").contains(gs.getTeam().getName())).toList());
        // Una eliminatoria ganada y un partido de grupo en juego no son victorias de la fase de grupos.
        matches.add(Match.builder().round("r16").homeTeam(team("Tres empates")).awayTeam(team("A1"))
                .homeScore(3).awayScore(0).finished(true).build());
        matches.add(Match.builder().round("group").homeTeam(team("Tres empates")).awayTeam(team("A2"))
                .homeScore(1).awayScore(0).finished(false).build());
        thirds.sort(GroupTiebreaker.thirdPlaceOrder(GroupTiebreak.UEFA, matches));

        assertThat(names(thirds)).containsExactly("Una victoria", "Tres empates");
    }
}
