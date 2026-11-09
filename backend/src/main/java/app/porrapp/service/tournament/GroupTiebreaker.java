package app.porrapp.service.tournament;

import app.porrapp.model.GroupStanding;
import app.porrapp.model.GroupTiebreak;
import app.porrapp.model.Match;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Collectors;

/**
 * Desempates de la fase de grupos. Es la única implementación: la usan la clasificación de cada grupo, el
 * estado matemático y el orden de los mejores terceros. Cada torneo sigue el reglamento de su organizador
 * ({@link GroupTiebreak}): el artículo 13 del de la Copa Mundial de la FIFA 26 (edición de mayo de 2026) o
 * el artículo 20 del de la Eurocopa 2022-24.
 * <p>
 * Dentro de un grupo los dos ordenan igual, así que la clasificación no pregunta por el reglamento; los
 * pasos y las letras son los de la FIFA. Entre equipos empatados a puntos:
 * <ol>
 *   <li>Paso 1, solo con los partidos entre los empatados: a) puntos, b) diferencia de goles, c) goles a favor.</li>
 *   <li>Paso 2: si a)–c) dejan empatados a algunos, se vuelven a aplicar a)–c) solo a los partidos entre esos
 *       equipos. Si así no se decide, se aplican en orden y sin volver a empezar d) diferencia de goles en todo
 *       el grupo, e) goles a favor en todo el grupo y f) puntos de conducta (fair play).</li>
 *   <li>Paso 3: g) y h) ranking mundial FIFA/Coca-Cola. La app no guarda ese ranking, así que los empates que
 *       llegan hasta aquí se ordenan por nombre para que el resultado sea estable.</li>
 * </ol>
 * En la UEFA el último criterio es el puesto en la clasificación general de la fase de clasificación, que
 * la app tampoco guarda. Su tanda de penaltis entre dos equipos igualados que empatan entre sí en la última
 * jornada no se deduce del marcador y no se aplica.
 * <p>
 * Los mejores terceros se comparan sin enfrentamientos directos, y ahí los reglamentos sí difieren: ver
 * {@link #thirdPlaceOrder(GroupTiebreak, List)}.
 * <p>
 * Los puntos de fair play se guardan como deducciones negativas, así que gana el valor más alto. Cada
 * partido los guarda ya con la escala de su reglamento ({@link GroupTiebreak#directRedCard()}).
 */
public final class GroupTiebreaker {

    /** Diferencia de goles y goles a favor en todos los partidos del grupo. */
    private static final Comparator<GroupStanding> GOALS_ORDER = Comparator
            .comparingInt(GroupTiebreaker::goalDiff).reversed()
            .thenComparing(Comparator.comparingInt(GroupTiebreaker::goalsFor).reversed());

    private static final Comparator<GroupStanding> FAIR_PLAY_ORDER =
            Comparator.comparingInt(GroupTiebreaker::fairPlay).reversed();

    /** Criterios d) a f): diferencia de goles, goles a favor y fair play en todos los partidos del grupo. */
    private static final Comparator<GroupStanding> OVERALL_ORDER = GOALS_ORDER.thenComparing(FAIR_PLAY_ORDER);

    /** Sustituto del ranking del organizador (criterios g y h de la FIFA), que la app no tiene. */
    private static final Comparator<GroupStanding> BY_NAME = Comparator.comparing(
            (GroupStanding gs) -> gs.getTeam() != null && gs.getTeam().getName() != null ? gs.getTeam().getName() : "");

    private static final Comparator<GroupStanding> POINTS_ORDER =
            Comparator.comparingInt(GroupTiebreaker::points).reversed();

    /** Terceros según la FIFA: puntos, diferencia de goles, goles a favor, fair play y nombre. */
    private static final Comparator<GroupStanding> FIFA_THIRD_PLACE_ORDER = POINTS_ORDER
            .thenComparing(OVERALL_ORDER)
            .thenComparing(BY_NAME);

    private GroupTiebreaker() {
    }

    /**
     * Orden de los mejores terceros, del mejor al peor.
     * <ul>
     *   <li>FIFA: puntos, diferencia de goles, goles a favor, fair play y, en lugar de su ranking, el nombre.</li>
     *   <li>UEFA: puntos, diferencia de goles, goles a favor, victorias, tarjetas y, en lugar de la
     *       clasificación general de la fase de clasificación, el nombre.</li>
     * </ul>
     *
     * @param tiebreak reglamento del torneo
     * @param matches  partidos del torneo: de ellos salen las victorias en la fase de grupos, que la
     *                 clasificación no guarda; la FIFA no las mira y puede ir vacía
     */
    public static Comparator<GroupStanding> thirdPlaceOrder(GroupTiebreak tiebreak, List<Match> matches) {
        if (!tiebreak.winsRankThirds()) return FIFA_THIRD_PLACE_ORDER;
        Map<Long, Integer> wins = groupStageWins(matches);
        return POINTS_ORDER
                .thenComparing(GOALS_ORDER)
                .thenComparing(Comparator.comparingInt((GroupStanding gs) -> wins.getOrDefault(teamId(gs), 0)).reversed())
                .thenComparing(FAIR_PLAY_ORDER)
                .thenComparing(BY_NAME);
    }

    /** Victorias de cada equipo en los partidos de grupo terminados. */
    private static Map<Long, Integer> groupStageWins(List<Match> matches) {
        Map<Long, Integer> wins = new HashMap<>();
        if (matches == null) return wins;
        for (Match m : matches) {
            if (!"group".equalsIgnoreCase(m.getRound()) || !isPlayed(m) || m.getHomeScore().equals(m.getAwayScore())) continue;
            Long winner = (m.getHomeScore() > m.getAwayScore() ? m.getHomeTeam() : m.getAwayTeam()).getId();
            wins.merge(winner, 1, Integer::sum);
        }
        return wins;
    }

    /**
     * Clasificación de un grupo ordenada del primero al último.
     *
     * @param standings equipos del grupo con sus puntos, goles y fair play
     * @param matches   partidos del grupo; solo cuentan los terminados con marcador
     * @return lista nueva ordenada; los empates que solo resolvería el ranking del organizador, por nombre
     */
    public static List<GroupStanding> sort(List<GroupStanding> standings, List<Match> matches) {
        List<GroupStanding> sorted = new ArrayList<>(standings.size());
        for (List<GroupStanding> tier : tiers(standings, matches)) {
            tier.sort(BY_NAME);
            sorted.addAll(tier);
        }
        return sorted;
    }

    /**
     * Bloques de equipos en orden de clasificación. Los equipos de un mismo bloque siguen empatados tras los
     * criterios a) a f): solo el ranking del organizador los separaría, así que pueden acabar en cualquiera de
     * sus puestos.
     */
    public static List<List<GroupStanding>> tiers(List<GroupStanding> standings, List<Match> matches) {
        List<Match> played = matches == null ? List.of() : matches.stream().filter(GroupTiebreaker::isPlayed).toList();
        Map<Integer, List<GroupStanding>> byPoints = standings.stream().collect(Collectors.groupingBy(
                GroupTiebreaker::points, () -> new TreeMap<>(Comparator.reverseOrder()), Collectors.toList()));

        List<List<GroupStanding>> tiers = new ArrayList<>();
        for (List<GroupStanding> level : byPoints.values()) {
            for (List<GroupStanding> stillTied : headToHead(level, played)) {
                tiers.addAll(splitBy(stillTied, OVERALL_ORDER));
            }
        }
        return tiers;
    }

    /**
     * Pasos 1 y 2 a)–c): mini-liga con los partidos entre los empatados. Cada subgrupo que siga empatado repite
     * la mini-liga solo con sus partidos; el que ya no se separa así se devuelve entero para los criterios d)–f).
     */
    private static List<List<GroupStanding>> headToHead(List<GroupStanding> tied, List<Match> played) {
        if (tied.size() < 2) return List.of(tied);
        Map<Long, int[]> table = miniLeague(tied, played);
        Comparator<GroupStanding> order = Comparator
                .comparingInt((GroupStanding gs) -> table.get(teamId(gs))[0]).reversed()
                .thenComparing(Comparator.comparingInt((GroupStanding gs) -> table.get(teamId(gs))[1]).reversed())
                .thenComparing(Comparator.comparingInt((GroupStanding gs) -> table.get(teamId(gs))[2]).reversed());
        List<List<GroupStanding>> blocks = splitBy(tied, order);
        if (blocks.size() == 1) return blocks;

        List<List<GroupStanding>> result = new ArrayList<>();
        for (List<GroupStanding> block : blocks) {
            result.addAll(headToHead(block, played));
        }
        return result;
    }

    /** Puntos, diferencia de goles y goles a favor de cada equipo contando solo los partidos entre ellos. */
    private static Map<Long, int[]> miniLeague(List<GroupStanding> teams, List<Match> played) {
        Map<Long, int[]> table = new HashMap<>();
        for (GroupStanding gs : teams) table.put(teamId(gs), new int[3]);
        for (Match m : played) {
            int[] home = table.get(m.getHomeTeam().getId());
            int[] away = table.get(m.getAwayTeam().getId());
            if (home == null || away == null) continue;
            addResult(home, m.getHomeScore(), m.getAwayScore());
            addResult(away, m.getAwayScore(), m.getHomeScore());
        }
        return table;
    }

    private static void addResult(int[] row, int scored, int conceded) {
        row[0] += scored > conceded ? 3 : scored == conceded ? 1 : 0;
        row[1] += scored - conceded;
        row[2] += scored;
    }

    /** Ordena con el comparador y junta en un bloque los equipos que empatan en él. */
    private static List<List<GroupStanding>> splitBy(List<GroupStanding> teams, Comparator<GroupStanding> order) {
        List<GroupStanding> sorted = new ArrayList<>(teams);
        sorted.sort(order);
        List<List<GroupStanding>> blocks = new ArrayList<>();
        for (GroupStanding gs : sorted) {
            List<GroupStanding> last = blocks.isEmpty() ? null : blocks.get(blocks.size() - 1);
            if (last != null && order.compare(last.get(0), gs) == 0) {
                last.add(gs);
            } else {
                List<GroupStanding> block = new ArrayList<>();
                block.add(gs);
                blocks.add(block);
            }
        }
        return blocks;
    }

    private static boolean isPlayed(Match m) {
        return Boolean.TRUE.equals(m.getFinished()) && m.getHomeScore() != null && m.getAwayScore() != null
                && m.getHomeTeam() != null && m.getAwayTeam() != null
                && m.getHomeTeam().getId() != null && m.getAwayTeam().getId() != null;
    }

    private static Long teamId(GroupStanding gs) {
        return gs.getTeam().getId();
    }

    private static int points(GroupStanding gs) {
        return gs.getPoints() != null ? gs.getPoints() : 0;
    }

    private static int goalDiff(GroupStanding gs) {
        return gs.getGoalDiff() != null ? gs.getGoalDiff() : 0;
    }

    private static int goalsFor(GroupStanding gs) {
        return gs.getGoalsFor() != null ? gs.getGoalsFor() : 0;
    }

    private static int fairPlay(GroupStanding gs) {
        return gs.getFairPlayPoints() != null ? gs.getFairPlayPoints() : 0;
    }
}
