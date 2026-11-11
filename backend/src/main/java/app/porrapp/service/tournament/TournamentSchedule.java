package app.porrapp.service.tournament;

import app.porrapp.dto.OrganizedTournamentDTO.*;
import app.porrapp.exception.BusinessException;
import java.util.*;

/** Schedule generation and advancement operate on copies, so a rejected correction changes nothing. */
public final class TournamentSchedule {
    private TournamentSchedule() {}

    public static List<Match> league(List<Participant> participants, int legs) {
        List<String> rotation = new ArrayList<>(participants.stream().map(Participant::id).toList());
        if (rotation.size() % 2 != 0) rotation.add(null);
        int rounds = rotation.size() - 1;
        List<Match> firstLeg = new ArrayList<>();
        for (int round = 1; round <= rounds; round++) {
            for (int i = 0; i < rotation.size() / 2; i++) {
                String home = rotation.get(i), away = rotation.get(rotation.size() - 1 - i);
                if (home != null && away != null) {
                    firstLeg.add(empty(round, i, round % 2 == 0 ? away : home, round % 2 == 0 ? home : away));
                }
            }
            rotation.add(1, rotation.remove(rotation.size() - 1));
        }
        List<Match> result = new ArrayList<>(firstLeg);
        if (legs == 2) for (Match match : firstLeg) {
            result.add(empty(match.round() + rounds, match.position(), match.awayId(), match.homeId()));
        }
        return result;
    }

    public static List<Match> knockout(List<Participant> participants, String draw) {
        List<Participant> ordered = new ArrayList<>(participants);
        if ("RANDOM".equals(draw)) Collections.shuffle(ordered, new java.security.SecureRandom());
        int size = 2;
        while (size < ordered.size()) size *= 2;
        List<Integer> seeds = new ArrayList<>(List.of(1, 2));
        while (seeds.size() < size) {
            int total = seeds.size() * 2 + 1;
            seeds = seeds.stream().flatMap(seed -> java.util.stream.Stream.of(seed, total - seed)).toList();
        }
        List<Match> result = new ArrayList<>();
        for (int i = 0; i < size; i += 2) {
            int a = "MANUAL".equals(draw) ? i : seeds.get(i) - 1;
            int b = "MANUAL".equals(draw) ? i + 1 : seeds.get(i + 1) - 1;
            result.add(empty(1, i / 2, a < ordered.size() ? ordered.get(a).id() : null,
                    b < ordered.size() ? ordered.get(b).id() : null));
        }
        for (int round = 2, count = size / 4; count > 0; round++, count /= 2) {
            for (int i = 0; i < count; i++) result.add(empty(round, i, null, null));
        }
        return advance(result);
    }

    public static List<Match> advance(List<Match> source) {
        List<Match> result = new ArrayList<>();
        Map<String, Match> slots = new HashMap<>();
        Set<String> resolved = new HashSet<>();
        for (Match original : source.stream().sorted(Comparator.comparingInt(Match::round).thenComparingInt(Match::position)).toList()) {
            String home = original.homeId(), away = original.awayId();
            boolean ready = original.round() == 1;
            if (!ready) {
                Match left = slots.get(key(original.round() - 1, original.position() * 2));
                Match right = slots.get(key(original.round() - 1, original.position() * 2 + 1));
                home = winner(left); away = winner(right);
                ready = resolved.contains(left.id()) && resolved.contains(right.id());
            }
            boolean changed = !Objects.equals(home, original.homeId()) || !Objects.equals(away, original.awayId());
            if (changed && original.outcome() != null && !original.bye()) {
                throw BusinessException.conflict("Hay un resultado en una ronda posterior. Bórralo antes de cambiar quién avanza.");
            }
            boolean bye = ready && (home == null || away == null);
            String outcome = bye ? (home != null ? "HOME" : away != null ? "AWAY" : null)
                    : changed || original.bye() ? null : original.outcome();
            Match match = new Match(original.id(), original.round(), original.position(), home, away,
                    original.scheduledAt(), original.venue(), changed || bye ? null : original.homeScore(),
                    changed || bye ? null : original.awayScore(), outcome, bye);
            result.add(match);
            slots.put(key(match.round(), match.position()), match);
            if (ready && (bye || outcome != null)) resolved.add(match.id());
        }
        return result;
    }

    public static List<Match> swap(List<Match> source, String first, String second) {
        return advance(source.stream().map(m -> m.round() != 1 ? m
                : new Match(m.id(), m.round(), m.position(), swapId(m.homeId(), first, second),
                        swapId(m.awayId(), first, second), m.scheduledAt(), m.venue(), null, null, null, false)).toList());
    }

    private static String swapId(String id, String first, String second) {
        return first.equals(id) ? second : second.equals(id) ? first : id;
    }

    private static String winner(Match match) {
        return "HOME".equals(match.outcome()) ? match.homeId() : "AWAY".equals(match.outcome()) ? match.awayId() : null;
    }

    private static String key(int round, int position) { return round + ":" + position; }

    public static Match empty(int round, int position, String home, String away) {
        return new Match(UUID.randomUUID().toString(), round, position, home, away, null, null, null, null, null, false);
    }

    public static List<Standing> standings(List<Participant> participants, List<Match> matches, int win, int draw, int loss) {
        Map<String, long[]> rows = new LinkedHashMap<>();
        participants.forEach(p -> rows.put(p.id(), new long[7]));
        for (Match match : matches) {
            if (match.outcome() == null || match.bye()) continue;
            long[] home = rows.get(match.homeId()), away = rows.get(match.awayId());
            home[0]++; away[0]++;
            if (match.homeScore() != null && match.awayScore() != null) {
                home[4] += match.homeScore(); home[5] += match.awayScore();
                away[4] += match.awayScore(); away[5] += match.homeScore();
            }
            if ("DRAW".equals(match.outcome())) { home[2]++; away[2]++; home[6] += draw; away[6] += draw; }
            else {
                long[] winner = "HOME".equals(match.outcome()) ? home : away;
                long[] loser = "HOME".equals(match.outcome()) ? away : home;
                winner[1]++; loser[3]++; winner[6] += win; loser[6] += loss;
            }
        }
        return rows.entrySet().stream().map(e -> {
            long[] r = e.getValue();
            return new Standing(e.getKey(), (int) r[0], (int) r[1], (int) r[2], (int) r[3], r[4], r[5], r[6]);
        }).sorted(Comparator.comparingLong(Standing::points).reversed()
                .thenComparing(Comparator.comparingLong((Standing s) -> s.scored() - s.conceded()).reversed())
                .thenComparing(Comparator.comparingLong(Standing::scored).reversed())).toList();
    }
}
