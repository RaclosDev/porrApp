package app.porrapp.scoring;

import app.porrapp.dto.TopScorerDTO;

import java.util.Arrays;
import java.util.List;

/**
 * Puntos del pichichi: los gana quien eligió a uno de los máximos goleadores; si hay varios empatados en
 * cabeza, los puntos se reparten entre ellos. Vale igual para el cuadro de un torneo y para una liga por
 * jornadas.
 */
public final class TopScorerAward {

    private TopScorerAward() {
    }

    /** Puntos ganados y el texto con el que salen en el desglose. */
    public record Award(int points, String message) {
    }

    /**
     * @param choice          pichichi de la porra
     * @param allScorers      goleadores de la competición, de más a menos goles
     * @param officialScorers nombres de los máximos goleadores separados por comas, por si no hay lista
     * @param topScorerPoints puntos de la regla
     * @return lo ganado, o null si no hay pichichi elegido, no acierta o aún no hay goleadores
     */
    public static Award evaluate(ScorerChoice choice, List<TopScorerDTO> allScorers, String officialScorers,
                                 int topScorerPoints) {
        if (topScorerPoints <= 0 || choice == null || choice.isBlank()) return null;

        if (allScorers != null && !allScorers.isEmpty()) {
            int maxGoals = allScorers.get(0).goals();
            if (maxGoals > 0) {
                List<TopScorerDTO> leaders = allScorers.stream().filter(s -> s.goals() == maxGoals).toList();
                List<ScorerNameMatcher.Player> known = allScorers.stream().map(TopScorerAward::player).toList();
                boolean hit = leaders.stream().anyMatch(leader -> isChosen(choice, player(leader), known));
                return hit ? award(choice, topScorerPoints, leaders.size()) : null;
            }
        }

        if (officialScorers != null && !officialScorers.trim().isEmpty()) {
            List<ScorerNameMatcher.Player> leaders = Arrays.stream(officialScorers.split(","))
                    .map(String::trim)
                    .filter(name -> !name.isEmpty())
                    .map(name -> new ScorerNameMatcher.Player("", name, name))
                    .toList();
            if (!leaders.isEmpty() && leaders.stream().anyMatch(leader -> isChosen(choice, leader, leaders))) {
                return award(choice, topScorerPoints, leaders.size());
            }
        }
        return null;
    }

    private static ScorerNameMatcher.Player player(TopScorerDTO scorer) {
        return new ScorerNameMatcher.Player(scorer.playerId(), scorer.name(), scorer.shortName());
    }

    /**
     * Si el pichichi elegido es este goleador. Con el jugador ya identificado (elegido de la lista o asignado
     * por el administrador) cuenta solo él, por su id o, si alguno no lo tiene, por su nombre; si no, se
     * empareja lo escrito.
     */
    private static boolean isChosen(ScorerChoice choice, ScorerNameMatcher.Player scorer,
                                    List<ScorerNameMatcher.Player> known) {
        if (!choice.hasPlayer()) return ScorerNameMatcher.isSamePlayer(choice.written(), scorer, known);
        boolean bothHaveId = choice.playerId() != null && !choice.playerId().isBlank()
                && scorer.id() != null && !scorer.id().isBlank();
        if (bothHaveId) return choice.playerId().equals(scorer.id());
        String name = ScorerNameMatcher.normalize(choice.playerName());
        return !name.isEmpty() && name.equals(ScorerNameMatcher.normalize(scorer.name()));
    }

    private static Award award(ScorerChoice choice, int topScorerPoints, int leaders) {
        int points = topScorerPoints / leaders;
        String name = choice.hasPlayer() && choice.byAdmin()
                ? choice.playerName() + " (asignado por el administrador)"
                : choice.written();
        return new Award(points, leaders > 1
                ? "Pichichi: " + name + " acertado (" + points + " pts repartidos)"
                : "Pichichi: " + name + " acertado");
    }
}
