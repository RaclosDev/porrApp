package app.porrapp.service.prediction;

import app.porrapp.model.Match;
import app.porrapp.model.MatchSelectionMode;
import app.porrapp.model.Team;

import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Partidos de su competición que entran en una liga por jornadas. Con {@link MatchSelectionMode#ALL}
 * entran todos; con {@link MatchSelectionMode#CUSTOM}, los de los equipos seguidos (también los que se
 * carguen más tarde) y los añadidos a mano, menos los quitados a mano.
 */
public record MatchSelection(MatchSelectionMode mode, Set<Long> teamIds, Set<Long> included, Set<Long> excluded) {

    public static final MatchSelection ALL = new MatchSelection(MatchSelectionMode.ALL, Set.of(), Set.of(), Set.of());

    public MatchSelection {
        mode = mode == null ? MatchSelectionMode.ALL : mode;
        boolean all = mode == MatchSelectionMode.ALL;
        teamIds = all || teamIds == null ? Set.of() : Set.copyOf(teamIds);
        included = all || included == null ? Set.of() : Set.copyOf(included);
        excluded = all || excluded == null ? Set.of() : Set.copyOf(excluded);
    }

    public boolean isAll() {
        return mode == MatchSelectionMode.ALL;
    }

    public boolean contains(Match match) {
        if (isAll()) return true;
        if (match == null || match.getId() == null || excluded.contains(match.getId())) return false;
        return included.contains(match.getId()) || followed(match);
    }

    /** Si el partido entra por uno de los equipos seguidos (antes de los cambios a mano). */
    public boolean followed(Match match) {
        return follows(match.getHomeTeam()) || follows(match.getAwayTeam());
    }

    private boolean follows(Team team) {
        return team != null && team.getId() != null && teamIds.contains(team.getId());
    }

    public List<Match> filter(List<Match> matches) {
        return isAll() ? matches : matches.stream().filter(this::contains).toList();
    }

    /**
     * La misma selección guardada con lo mínimo: dados el modo, los equipos y los partidos que deben
     * entrar del calendario, solo se apuntan a mano las diferencias con lo que dan los equipos.
     */
    public static MatchSelection normalized(MatchSelectionMode mode, Collection<Long> teamIds,
                                            Collection<Match> calendar, Set<Long> wanted) {
        if (mode == MatchSelectionMode.ALL) return ALL;
        MatchSelection base = new MatchSelection(mode, new HashSet<>(teamIds), Set.of(), Set.of());
        Set<Long> included = new HashSet<>();
        Set<Long> excluded = new HashSet<>();
        for (Match match : calendar) {
            boolean byTeam = base.followed(match);
            boolean in = wanted.contains(match.getId());
            if (in && !byTeam) included.add(match.getId());
            if (!in && byTeam) excluded.add(match.getId());
        }
        return new MatchSelection(mode, base.teamIds(), included, excluded);
    }
}
