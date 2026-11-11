package app.porrapp.service.tournament;

import app.porrapp.dto.OrganizedTournamentDTO.*;
import app.porrapp.exception.BusinessException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import java.util.*;
import java.util.stream.IntStream;
import static org.assertj.core.api.Assertions.*;

class TournamentScheduleTest {
    static List<Participant> participants(int count) {
        return IntStream.rangeClosed(1, count).mapToObj(i -> new Participant("p" + i, "Participante " + i)).toList();
    }

    @ParameterizedTest @ValueSource(ints = {2, 3, 4, 5, 7, 16, 63, 64})
    void leagueHasEveryPairOnceAndNobodyPlaysTwiceInARound(int count) {
        List<Match> schedule = TournamentSchedule.league(participants(count), 1);
        assertThat(schedule).hasSize(count * (count - 1) / 2);
        Set<Set<String>> pairs = new HashSet<>();
        Map<Integer, Set<String>> rounds = new HashMap<>();
        for (Match match : schedule) {
            assertThat(pairs.add(Set.of(match.homeId(), match.awayId()))).isTrue();
            Set<String> players = rounds.computeIfAbsent(match.round(), key -> new HashSet<>());
            assertThat(players.add(match.homeId())).isTrue();
            assertThat(players.add(match.awayId())).isTrue();
        }
        List<Match> returnLeg = TournamentSchedule.league(participants(count), 2);
        assertThat(returnLeg).hasSize(schedule.size() * 2);
        for (Match first : returnLeg.subList(0, schedule.size())) {
            assertThat(returnLeg).anyMatch(m -> m.homeId().equals(first.awayId()) && m.awayId().equals(first.homeId()));
        }
    }

    @Test
    void everyBracketSizeAndDrawReachesOneWinnerWithoutLosingParticipants() {
        for (int count = 2; count <= 64; count++) {
            for (String draw : List.of("SEEDED", "MANUAL", "RANDOM")) {
                List<Match> matches = TournamentSchedule.knockout(participants(count), draw);
                assertThat(matches.stream().filter(m -> m.round() == 1).flatMap(m -> java.util.stream.Stream.of(m.homeId(), m.awayId())).filter(Objects::nonNull))
                        .containsExactlyInAnyOrderElementsOf(participants(count).stream().map(Participant::id).toList());
                int played = 0;
                while (true) {
                    Optional<Match> next = matches.stream().filter(m -> !m.bye() && m.outcome() == null && m.homeId() != null && m.awayId() != null).findFirst();
                    if (next.isEmpty()) break;
                    Match match = next.get(); played++;
                    matches = TournamentSchedule.advance(matches.stream().map(m -> m.id().equals(match.id()) ? m.withResult(2, 1, "HOME") : m).toList());
                }
                assertThat(played).as("%s participants in %s", count, draw).isEqualTo(count - 1);
                assertThat(matches.getLast().outcome()).isIn("HOME", "AWAY");
            }
        }
    }

    @Test
    void correctionPropagatesButCannotOverwriteAPlayedFinal() {
        List<Match> initial = TournamentSchedule.knockout(participants(4), "MANUAL");
        List<Match> semis = TournamentSchedule.advance(initial.stream().map(m -> m.round() == 1 ? m.withResult(null, null, "HOME") : m).toList());
        assertThat(semis.getLast().homeId()).isEqualTo("p1");
        List<Match> corrected = TournamentSchedule.advance(semis.stream().map(m -> m.equals(semis.getFirst()) ? m.withResult(null, null, "AWAY") : m).toList());
        assertThat(corrected.getLast().homeId()).isEqualTo("p2");
        List<Match> finished = semis.stream().map(m -> m.round() == 2 ? m.withResult(1, 0, "HOME") : m).toList();
        assertThatThrownBy(() -> TournamentSchedule.advance(finished.stream().map(m -> m.round() == 1 && m.position() == 0 ? m.withResult(0, 1, "AWAY") : m).toList()))
                .isInstanceOf(BusinessException.class).hasMessageContaining("ronda posterior");
        assertThat(finished.getLast().homeId()).isEqualTo("p1");
    }

    @Test
    void swappingParticipantsRecomputesByesAndKeepsMatchIdentity() {
        List<Match> initial = TournamentSchedule.knockout(participants(3), "SEEDED");
        List<Match> moved = TournamentSchedule.swap(initial, "p1", "p3");
        assertThat(moved).extracting(Match::id).containsExactlyElementsOf(initial.stream().map(Match::id).toList());
        assertThat(moved.getFirst().homeId()).isEqualTo("p3");
        assertThat(moved.getFirst().bye()).isTrue();
        assertThat(moved.getLast().homeId()).isEqualTo("p3");
        assertThat(moved.stream().filter(m -> m.round() == 1).flatMap(m -> java.util.stream.Stream.of(m.homeId(), m.awayId())).filter(Objects::nonNull))
                .containsExactlyInAnyOrder("p1", "p2", "p3");
    }

    @Test
    void standingsUseRealResultsAndConfiguredPoints() {
        List<Match> matches = List.of(TournamentSchedule.empty(1, 0, "p1", "p2").withResult(3, 1, "HOME"),
                TournamentSchedule.empty(2, 0, "p2", "p3").withResult(null, null, "DRAW"),
                TournamentSchedule.empty(3, 0, "p1", "p3"));
        List<Standing> rows = TournamentSchedule.standings(participants(3), matches, 2, 1, 0);
        assertThat(rows.getFirst()).isEqualTo(new Standing("p1", 1, 1, 0, 0, 3, 1, 2));
        assertThat(rows.get(1)).isEqualTo(new Standing("p3", 1, 0, 1, 0, 0, 0, 1));
        assertThat(rows.get(2)).isEqualTo(new Standing("p2", 2, 0, 1, 1, 1, 3, 1));
    }
}
