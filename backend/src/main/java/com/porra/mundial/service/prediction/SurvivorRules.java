package com.porra.mundial.service.prediction;

import com.porra.mundial.model.Match;
import com.porra.mundial.model.MatchPrediction;
import com.porra.mundial.model.Team;
import com.porra.mundial.model.Edition;
import com.porra.mundial.scoring.MatchScoreResult;
import com.porra.mundial.scoring.ScoringRuleSet;

import com.porra.mundial.util.MatchRound;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Reglas del modo superviviente. Cada elección es una predicción de partido con signo "1" (gana el
 * local) o "2" (gana el visitante). Si su equipo gana, supera la jornada; si pierde o empata (salvo que la
 * liga diga que el empate salva), o si no elige, gasta una vida, y sin vidas queda eliminado. El
 * administrador fija los puntos por jornada, las vidas y si el empate salva ({@link Settings}).
 */
public final class SurvivorRules {
    private SurvivorRules() {}

    /**
     * Reglas de una liga superviviente.
     *
     * @param roundPoints  puntos por jornada superada
     * @param lives        fallos que aguanta cada participante (1: el primero lo elimina)
     * @param drawSurvives un empate de su equipo cuenta como jornada superada
     */
    public record Settings(int roundPoints, int lives, boolean drawSurvives) {
        public static final Settings DEFAULT = new Settings(1, 1, false);

        public static Settings of(ScoringRuleSet rules) {
            if (rules == null) return DEFAULT;
            return new Settings(Math.max(0, rules.getSurvivorRoundPoints()), Math.max(1, rules.getSurvivorLives()),
                    rules.getSurvivorDrawSurvives() == 1);
        }

        public static Settings of(Edition edition) {
            return of(ScoringRuleSet.forEdition(edition));
        }
    }

    /** Equipo elegido, o null si el signo no es una elección válida. */
    public static Team pickedTeam(String sign, Match match) {
        if (match == null) return null;
        if ("1".equals(sign)) return match.getHomeTeam();
        if ("2".equals(sign)) return match.getAwayTeam();
        return null;
    }

    public static Team pickedTeam(MatchPrediction pick) {
        return pick == null ? null : pickedTeam(pick.getPredictionSign(), pick.getMatch());
    }

    /** Puntos de una elección con el marcador actual (provisional mientras el partido sigue en juego). */
    public static MatchScoreResult score(String sign, Integer home, Integer away, Team team) {
        return score(sign, home, away, team, Settings.DEFAULT);
    }

    public static MatchScoreResult score(String sign, Integer home, Integer away, Team team, Settings settings) {
        String name = team != null && team.getName() != null ? team.getName() : "Tu equipo";
        if (home == null || away == null || !("1".equals(sign) || "2".equals(sign))) {
            return MatchScoreResult.zero("Sin elección");
        }
        boolean won = "1".equals(sign) ? home > away : away > home;
        if (won) return new MatchScoreResult(settings.roundPoints(), false, true, false, name + " gana: sobrevives");
        if (home.equals(away) && settings.drawSurvives()) {
            return new MatchScoreResult(settings.roundPoints(), false, true, false, name + " empata: sigues vivo");
        }
        return MatchScoreResult.zero(name + (settings.lives() > 1 ? " no gana: pierdes una vida" : " no gana: eliminado"));
    }

    /** Si la elección está decidida y supera la jornada (gana o, si la liga lo permite, empata). */
    static boolean survives(MatchPrediction pick, Settings settings) {
        Match match = pick.getMatch();
        return isDecided(match) && score(pick.getPredictionSign(), match.getHomeScore(), match.getAwayScore(),
                pickedTeam(pick), settings).correctSign();
    }

    /** Solo un partido terminado con marcador elimina o hace sobrevivir. */
    static boolean isDecided(Match match) {
        return match != null && Boolean.TRUE.equals(match.getFinished())
                && match.getHomeScore() != null && match.getAwayScore() != null;
    }

    /**
     * Situación de un participante: jornadas superadas hasta quedarse sin vidas y si ya está eliminado.
     *
     * @param eliminatedAt    cuándo cayó (su partido, o el último partido de la jornada que no eligió);
     *                        null si sigue vivo
     * @param eliminatedRound jornada en que cayó, o null si sigue vivo
     * @param missed          cayó por no elegir equipo en una jornada
     * @param livesLeft       vidas que le quedan (0 si está eliminado)
     */
    public record Standing(int survived, boolean eliminated, Instant eliminatedAt, String eliminatedRound,
                           boolean missed, int livesLeft) {
        static Standing alive(int survived, int livesLeft) {
            return new Standing(survived, false, null, null, false, livesLeft);
        }
    }

    /** Situación teniendo en cuenta solo las elecciones hechas (sin calendario no hay jornadas sin elegir). */
    public static Standing standing(List<MatchPrediction> picks) {
        return standing(picks, List.of(), null, null, Settings.DEFAULT);
    }

    public static Standing standing(List<MatchPrediction> picks, List<Match> calendar, Instant startAt, Instant now) {
        return standing(picks, calendar, startAt, now, Settings.DEFAULT);
    }

    /**
     * Situación de un participante recorriendo las jornadas en orden. Una jornada con elección suma si
     * la supera y gasta una vida si no. Una jornada sin elección gasta una vida en cuanto han empezado
     * todos sus partidos (ya no se puede elegir), salvo que empezara antes de que el participante
     * entrase en la liga. Sin vidas, queda eliminado.
     *
     * @param calendar partidos de la competición; vacío para no contar las jornadas sin elegir
     * @param startAt  desde cuándo juega el participante (al unirse a la liga); null para no contarlas
     * @param now      momento de la comprobación
     */
    public static Standing standing(List<MatchPrediction> picks, List<Match> calendar, Instant startAt, Instant now,
                                    Settings settings) {
        Map<String, MatchPrediction> pickByRound = new HashMap<>();
        Map<String, List<Match>> rounds = new LinkedHashMap<>();
        for (Match match : calendar) {
            if (match == null || (Team.isPlaceholder(match.getHomeTeam()) && Team.isPlaceholder(match.getAwayTeam()))) {
                continue;
            }
            rounds.computeIfAbsent(MatchRound.label(match), key -> new ArrayList<>()).add(match);
        }
        for (MatchPrediction pick : picks) {
            if (pick == null || pick.getMatch() == null) continue;
            String round = MatchRound.label(pick.getMatch());
            pickByRound.merge(round, pick, (a, b) -> a);
            rounds.computeIfAbsent(round, key -> new ArrayList<>(List.of(pick.getMatch())));
        }

        List<Map.Entry<String, List<Match>>> ordered = new ArrayList<>(rounds.entrySet());
        ordered.sort(Comparator.comparing(entry -> firstStart(entry.getValue()),
                Comparator.nullsLast(Comparator.naturalOrder())));

        int survived = 0;
        int lives = settings.lives();
        for (Map.Entry<String, List<Match>> round : ordered) {
            MatchPrediction pick = pickByRound.get(round.getKey());
            if (pick != null) {
                if (!isDecided(pick.getMatch())) continue;
                if (survives(pick, settings)) {
                    survived++;
                } else if (--lives <= 0) {
                    return new Standing(survived, true, pick.getMatch().getMatchDate(), round.getKey(), false, 0);
                }
                continue;
            }
            Instant first = firstStart(round.getValue());
            Instant last = lastStart(round.getValue());
            boolean countsForPlayer = startAt != null && first != null && !first.isBefore(startAt);
            if (countsForPlayer && now != null && last != null && !last.isAfter(now) && --lives <= 0) {
                return new Standing(survived, true, last, round.getKey(), true, 0);
            }
        }
        return Standing.alive(survived, lives);
    }

    private static Instant firstStart(List<Match> matches) {
        return matches.stream().map(Match::getMatchDate).filter(Objects::nonNull)
                .min(Comparator.naturalOrder()).orElse(null);
    }

    /** Inicio del último partido de la jornada; null si alguno no tiene fecha (aún se podría elegir). */
    private static Instant lastStart(List<Match> matches) {
        if (matches.stream().anyMatch(match -> match.getMatchDate() == null)) return null;
        return matches.stream().map(Match::getMatchDate).max(Comparator.naturalOrder()).orElse(null);
    }
}
