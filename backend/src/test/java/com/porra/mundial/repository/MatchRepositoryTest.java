package com.porra.mundial.repository;

import com.porra.mundial.model.Competition;
import com.porra.mundial.model.Match;
import com.porra.mundial.model.Team;
import com.porra.mundial.util.MatchRound;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.jpa.test.autoconfigure.TestEntityManager;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** La consulta de una jornada contra Postgres real: devuelve lo mismo que filtrar la temporada en Java. */
@DataJpaTest(properties = "spring.flyway.out-of-order=true")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers(disabledWithoutDocker = true)
class MatchRepositoryTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired
    private TestEntityManager em;

    @Autowired
    private MatchRepository matchRepository;

    @Autowired
    private CompetitionRepository competitionRepository;

    private List<Long> roundIds(Long competitionId, String round) {
        MatchRound.Lookup lookup = MatchRound.lookup(round);
        return matchRepository.findRoundCandidates(competitionId, lookup.names(), lookup.dayStart(),
                        lookup.dayEnd(), lookup.undated()).stream()
                .filter(m -> MatchRound.matches(m, round.trim()))
                .map(Match::getId)
                .toList();
    }

    private List<Long> seasonFilteredInJava(Long competitionId, String round) {
        return matchRepository.findByCompetitionIdOrderByMatchDateAsc(competitionId).stream()
                .filter(m -> MatchRound.matches(m, round.trim()))
                .map(Match::getId)
                .toList();
    }

    @Test
    void findsTheMatchesOfALeagueMatchdayWhateverTheCase() {
        Long laLiga = competitionRepository.findIdByExternalId("esp.1").orElseThrow();

        List<Long> jornada3 = roundIds(laLiga, "jornada 3");

        assertThat(jornada3).isNotEmpty().isEqualTo(seasonFilteredInJava(laLiga, "Jornada 3"));
        assertThat(roundIds(laLiga, "Jornada 99")).isEmpty();
    }

    @Test
    void findsGroupAndDateMatchdays() {
        Competition worldCup = competitionRepository.findByExternalId(Competition.WORLD_CUP_EXTERNAL_ID).orElseThrow();
        Team home = em.persist(Team.builder().name("Local A").groupName("A").build());
        Team away = em.persist(Team.builder().name("Visitante A").groupName("A").build());
        LocalDateTime day = LocalDateTime.of(2026, 6, 20, 21, 0);
        Match groupA = em.persist(Match.builder().competition(worldCup).homeTeam(home).awayTeam(away)
                .groupName("A").externalId("t-group-a").matchDate(day).build());
        Match dated = em.persist(Match.builder().competition(worldCup).homeTeam(away).awayTeam(home)
                .externalId("t-dated").matchDate(day.withHour(23)).build());
        em.persist(Match.builder().competition(worldCup).homeTeam(home).awayTeam(away)
                .externalId("t-other-day").matchDate(day.plusDays(1)).build());
        em.flush();

        assertThat(roundIds(worldCup.getId(), "Grupo A")).containsExactly(groupA.getId());
        assertThat(roundIds(worldCup.getId(), "Fecha 2026-06-20")).containsExactly(dated.getId());
        assertThat(roundIds(worldCup.getId(), "Fecha 2026-06-20"))
                .isEqualTo(seasonFilteredInJava(worldCup.getId(), "Fecha 2026-06-20"));
    }
}
