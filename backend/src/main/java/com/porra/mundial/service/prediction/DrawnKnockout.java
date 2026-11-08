package com.porra.mundial.service.prediction;

import com.porra.mundial.model.Edition;
import com.porra.mundial.model.Match;
import com.porra.mundial.model.Team;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Eliminatorias que se sortean ronda a ronda (Champions, Copa del Rey…). Cada cruce agrupa sus partidos
 * (ida y vuelta, o uno solo) y se pronostica quién pasa, no cada partido. Una ronda se puede pronosticar
 * en cuanto se conocen todos sus cruces, es decir, tras su sorteo.
 * <p>
 * Los playoffs de la NBA van igual, con series al mejor de 7 en vez de cruces: play-in (partido único),
 * primera ronda, semifinales y finales de conferencia y Finales. Cada serie se puede pronosticar en cuanto
 * se conocen sus dos equipos, y además de quién la gana se elige en cuántos partidos.
 */
public final class DrawnKnockout {
    /** Rondas eliminatorias en orden. Tras el playoff de la UEFA vienen los octavos. */
    static final List<String> ROUNDS = List.of("playoff", "r32", "r16", "qf", "sf", "final");

    /**
     * Rondas de los playoffs de la NBA: play-in, primera ronda («r16», 8 series), semifinales de conferencia
     * («qf»), finales de conferencia («sf») y Finales.
     */
    static final List<String> SERIES_ROUNDS = List.of("playin", "r16", "qf", "sf", "final");

    /** Series al mejor de 7: gana quien llega a 4 victorias. */
    public static final int SERIES_BEST_OF = 7;

    /** Cruces que tiene cada ronda: hasta tenerlos todos no se da por sorteada. */
    private static final Map<String, Integer> EXPECTED_TIES = Map.of(
            "playoff", 8, "r32", 16, "r16", 8, "qf", 4, "sf", 2, "final", 1, "playin", 6);

    /** Entre las eliminatorias de una temporada y las de la siguiente pasan meses. */
    private static final Duration NEW_SEASON_GAP = Duration.ofDays(90);

    private static final Comparator<Match> BY_DATE = Comparator
            .comparing(Match::getMatchDate, Comparator.nullsLast(Comparator.<Instant>naturalOrder()))
            .thenComparing(Match::getId, Comparator.nullsLast(Comparator.<Long>naturalOrder()));

    private DrawnKnockout() {
    }

    /** Un cruce: sus partidos por fecha (la ida primero). El local es el de la ida. */
    public record Tie(List<Match> legs) {
        public Team home() {
            return legs.get(0).getHomeTeam();
        }

        public Team away() {
            return legs.get(0).getAwayTeam();
        }

        /** Sorteado: los dos rivales son equipos reales. */
        public boolean drawn() {
            return isReal(home()) && isReal(away());
        }

        /** Primer partido con fecha, o null. */
        public Instant start() {
            return legs.stream().map(Match::getMatchDate).filter(Objects::nonNull).min(Instant::compareTo).orElse(null);
        }

        /**
         * Quién pasa: lo marca el último partido, el que decide el cruce (la vuelta, con la prórroga y los
         * penaltis). El ganador de la ida no cuenta.
         */
        public Team winner() {
            Match decider = legs.get(legs.size() - 1);
            // Una serie al mejor de 7 la decide el partido de la cuarta victoria: después puede quedar alguno
            // «si hace falta» sin jugar. Solo ese partido trae ganador (el de la serie).
            if (legs.size() > 2) {
                decider = legs.stream()
                        .filter(leg -> Boolean.TRUE.equals(leg.getFinished()) && leg.getWinnerTeam() != null)
                        .reduce((first, second) -> second).orElse(decider);
            }
            Team winner = decider.getWinnerTeam();
            return Boolean.TRUE.equals(decider.getFinished()) && winner != null
                    && (sameTeam(winner, home()) || sameTeam(winner, away())) ? winner : null;
        }

        /** Partidos ya jugados del cruce: en una serie decidida, en cuántos se ha ganado (4 a 7). */
        public int gamesPlayed() {
            return (int) legs.stream().filter(leg -> Boolean.TRUE.equals(leg.getFinished())).count();
        }

        public boolean has(String team) {
            return team != null && (team.equals(name(home())) || team.equals(name(away())));
        }
    }

    /**
     * Una ronda con sus cruces en el orden en que se importaron, que no cambia aunque se mueva una fecha:
     * cada elección se guarda en la posición de su cruce.
     *
     * @param key          "playoff", "r32", "r16", "qf", "sf" o "final"
     * @param expectedTies cruces que tiene la ronda
     * @param bestOf       en la NBA, partidos máximos de cada serie (1 en el play-in, 7 en el resto); 0 en
     *                     fútbol, donde se elige solo quién pasa
     */
    public record Round(String key, List<Tie> ties, int expectedTies, int bestOf) {
        public Round(String key, List<Tie> ties, int expectedTies) {
            this(key, ties, expectedTies, 0);
        }

        /**
         * Se puede pronosticar: en fútbol, cuando ya se conocen todos sus cruces; en la NBA, en cuanto hay
         * alguna serie con sus dos equipos (cada una se abre por su cuenta).
         */
        public boolean drawn() {
            if (series()) return !ties.isEmpty() && ties.stream().allMatch(Tie::drawn);
            return !ties.isEmpty() && ties.size() >= expectedTies && ties.stream().allMatch(Tie::drawn);
        }

        /** Series de la NBA (o partidos del play-in), no cruces de fútbol. */
        public boolean series() {
            return bestOf > 0;
        }
    }

    /** La edición pronostica unas eliminatorias que se sortean ronda a ronda. */
    public static boolean applies(Edition edition) {
        return PredictableBracket.applies(edition) && edition.getCompetition().drawsKnockoutRounds();
    }

    /**
     * Rondas que se pronostican en la edición, de la primera a la final. Solo cuenta la última temporada
     * de la competición; si ya había terminado al crear la liga, aún no hay nada (el sorteo de la nueva
     * llegará). Las rondas que ya habían empezado al crearla no se pronostican: la porra empieza en la
     * primera que quedaba por jugar, por ejemplo en octavos.
     */
    public static List<Round> rounds(Edition edition, List<Match> all) {
        boolean series = playsSeries(edition);
        List<String> order = series ? SERIES_ROUNDS : ROUNDS;
        List<Match> knockout = all.stream()
                .filter(match -> match.getRound() != null && order.contains(match.getRound()))
                .filter(match -> isReal(match.getHomeTeam()) || isReal(match.getAwayTeam()))
                .sorted(BY_DATE)
                .toList();
        knockout = lastSeason(knockout);
        Instant created = edition == null ? null : edition.getCreatedAt();
        boolean seasonOver = knockout.stream().anyMatch(match -> "final".equals(match.getRound())
                && Boolean.TRUE.equals(match.getFinished())
                && match.getMatchDate() != null && created != null && match.getMatchDate().isBefore(created));
        if (knockout.isEmpty() || seasonOver) return List.of();

        Map<String, List<Match>> byRound = new LinkedHashMap<>();
        for (Match match : knockout) byRound.computeIfAbsent(match.getRound(), key -> new ArrayList<>()).add(match);
        List<String> sequence = new ArrayList<>();
        for (String key : order) {
            if (sequence.isEmpty() && !byRound.containsKey(key)) continue;
            // Del playoff de la UEFA se pasa a octavos: no hay dieciseisavos.
            if ("r32".equals(key) && sequence.contains("playoff") && !byRound.containsKey(key)) continue;
            sequence.add(key);
        }
        List<Round> rounds = new ArrayList<>();
        for (String key : sequence) {
            List<Tie> ties = ties(byRound.getOrDefault(key, List.of()));
            rounds.add(new Round(key, ties, EXPECTED_TIES.getOrDefault(key, ties.size()),
                    !series ? 0 : "playin".equals(key) ? 1 : SERIES_BEST_OF));
        }
        while (rounds.size() > 1 && created != null && startedBefore(rounds.get(0), created)) {
            rounds.remove(0);
        }
        return rounds;
    }

    /** Partidos de la ronda agrupados en cruces por pareja de rivales, por orden de importación. */
    static List<Tie> ties(List<Match> matches) {
        Map<String, List<Match>> byPair = new LinkedHashMap<>();
        for (Match match : matches.stream().sorted(BY_DATE).toList()) {
            byPair.computeIfAbsent(pairKey(match), key -> new ArrayList<>()).add(match);
        }
        return byPair.values().stream().map(legs -> new Tie(List.copyOf(legs)))
                .sorted(Comparator.comparing(tie -> tie.legs().stream().map(Match::getId).filter(Objects::nonNull)
                        .min(Long::compareTo).orElse(Long.MAX_VALUE)))
                .toList();
    }

    /** Puntos de acertar quién pasa en una ronda: el playoff vale como dieciseisavos y la final, como campeón. */
    public static int points(String round, com.porra.mundial.scoring.ScoringRuleSet rules) {
        return switch (round) {
            case "final" -> rules.getChampionPoints();
            case "sf" -> rules.getSemiFinalPoints();
            case "qf" -> rules.getQuarterFinalPoints();
            case "r16" -> rules.getRoundOf16Points();
            default -> rules.getRoundOf32Points();
        };
    }

    /** La edición pronostica series de la NBA. */
    public static boolean playsSeries(Edition edition) {
        return edition != null && edition.getCompetition() != null && edition.getCompetition().playsSeries();
    }

    /** Puntos de acertar quién gana una serie de la NBA (o un partido del play-in). */
    public static int seriesPoints(String round, com.porra.mundial.scoring.ScoringRuleSet rules) {
        return switch (round) {
            case "playin" -> rules.getNbaPlayInPoints();
            case "r16" -> rules.getNbaFirstRoundPoints();
            case "qf" -> rules.getNbaConferenceSemifinalPoints();
            case "sf" -> rules.getNbaConferenceFinalPoints();
            default -> rules.getNbaFinalsPoints();
        };
    }

    /** Puntos extra de acertar además en cuántos partidos se gana la serie (el play-in no tiene). */
    public static int seriesExactPoints(String round, com.porra.mundial.scoring.ScoringRuleSet rules) {
        return switch (round) {
            case "playin" -> 0;
            case "r16" -> rules.getNbaFirstRoundExactPoints();
            case "qf" -> rules.getNbaConferenceSemifinalExactPoints();
            case "sf" -> rules.getNbaConferenceFinalExactPoints();
            default -> rules.getNbaFinalsExactPoints();
        };
    }

    /** Nombre de una ronda de los playoffs de la NBA. */
    public static String seriesTitle(String round) {
        return switch (round) {
            case "playin" -> "Play-in";
            case "r16" -> "Primera ronda";
            case "qf" -> "Semifinales de conferencia";
            case "sf" -> "Finales de conferencia";
            case "final" -> "Finales";
            default -> round;
        };
    }

    /** Nombre de la ronda para los textos. */
    public static String title(String round) {
        return switch (round) {
            case "playoff" -> "Playoff";
            case "r32" -> "Dieciseisavos";
            case "r16" -> "Octavos";
            case "qf" -> "Cuartos";
            case "sf" -> "Semifinales";
            case "final" -> "Final";
            default -> round;
        };
    }

    /** Las eliminatorias de la última temporada: tras un parón de meses empieza otra. */
    private static List<Match> lastSeason(List<Match> sorted) {
        int start = 0;
        for (int i = 1; i < sorted.size(); i++) {
            Instant previous = sorted.get(i - 1).getMatchDate();
            Instant current = sorted.get(i).getMatchDate();
            if (previous != null && current != null && Duration.between(previous, current).compareTo(NEW_SEASON_GAP) > 0) {
                start = i;
            }
        }
        return sorted.subList(start, sorted.size());
    }

    private static boolean startedBefore(Round round, Instant moment) {
        return round.ties().stream().map(Tie::start).filter(Objects::nonNull).anyMatch(start -> start.isBefore(moment));
    }

    /** Ida y vuelta comparten pareja (con el local cambiado); un cruce aún sin rival es solo suyo. */
    private static String pairKey(Match match) {
        Team home = match.getHomeTeam();
        Team away = match.getAwayTeam();
        if (!isReal(home) || !isReal(away)) return "match:" + match.getId();
        long first = Math.min(home.getId(), away.getId());
        long second = Math.max(home.getId(), away.getId());
        return first + ":" + second;
    }

    private static boolean isReal(Team team) {
        return team != null && team.getId() != null && !Team.isPlaceholder(team);
    }

    private static boolean sameTeam(Team left, Team right) {
        return left != null && right != null && Objects.equals(left.getId(), right.getId());
    }

    static String name(Team team) {
        return team == null ? null : team.getName();
    }
}
