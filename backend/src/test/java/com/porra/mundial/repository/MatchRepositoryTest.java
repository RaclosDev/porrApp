package com.porra.mundial.repository;

import com.porra.mundial.model.Competition;
import com.porra.mundial.model.MatchStatusNormalized;
import com.porra.mundial.model.UserAccount;
import com.porra.mundial.model.League;
import com.porra.mundial.model.Membership;
import com.porra.mundial.model.Edition;
import com.porra.mundial.model.PoolFormat;
import com.porra.mundial.model.Prediction;
import com.porra.mundial.model.MatchPrediction;
import org.hibernate.SessionFactory;
import org.springframework.data.domain.PageRequest;
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

    @Autowired private MembershipRepository membershipRepository;
    @Autowired private MatchPredictionRepository matchPredictionRepository;

    private org.hibernate.stat.Statistics statistics() {
        var statistics = em.getEntityManager().getEntityManagerFactory().unwrap(SessionFactory.class).getStatistics();
        statistics.setStatisticsEnabled(true);
        statistics.clear();
        return statistics;
    }

    @Test
    void radarFiltersBeforeLimitingAndKeepsMissingTeams() {
        var competition = em.persist(Competition.builder().name("Radar test").build());
        var other = em.persist(Competition.builder().name("Other radar").build());
        var home = em.persist(Team.builder().name("Radar home").build());
        var placeholder = em.persist(Team.builder().name("Radar placeholder").nameEn("tBd").build());
        var now = LocalDateTime.of(2040, 1, 1, 12, 0);
        for (int i = 1; i <= 200; i++) {
            em.persist(Match.builder().competition(competition).homeTeam(home).awayTeam(placeholder)
                    .matchDate(now.plusHours(i)).build());
        }
        // Both placeholders are excluded even if their date would sort first.
        em.persist(Match.builder().competition(competition).homeTeam(placeholder).awayTeam(placeholder)
                .matchDate(now.plusMinutes(1)).build());
        em.persist(Match.builder().competition(other).matchDate(now.plusMinutes(2)).build());
        em.persist(Match.builder().competition(competition).status(MatchStatusNormalized.POSTPONED)
                .matchDate(now.plusMinutes(3)).build());
        var missingTeams = em.persist(Match.builder().competition(competition).status(null)
                .matchDate(now.plusMinutes(4)).build());
        var live = em.persist(Match.builder().competition(competition).status(MatchStatusNormalized.LIVE)
                .finished(null).matchDate(now.minusMinutes(10)).build());
        var finished = em.persist(Match.builder().competition(competition).finished(true).matchDate(now).build());
        var undated = em.persist(Match.builder().competition(competition).finished(true).matchDate(null).build());
        em.flush(); em.clear();
        var stats = statistics();
        var next = matchRepository.findRadarNext(competition.getId(), now, MatchStatusNormalized.SCHEDULED, PageRequest.of(0, 5));
        assertThat(next).hasSize(5);
        assertThat(next.get(0).getId()).isEqualTo(missingTeams.getId());
        assertThat(next.get(1).getHomeTeam().getName()).isEqualTo("Radar home");
        assertThat(stats.getPrepareStatementCount()).isEqualTo(1);
        assertThat(stats.getEntityLoadCount()).isLessThan(15);
        assertThat(matchRepository.findRadarLive(competition.getId(), now.minusHours(3).minusMinutes(30), now.plusMinutes(20),
                List.of(MatchStatusNormalized.SCHEDULED, MatchStatusNormalized.LIVE, MatchStatusNormalized.PAUSED)))
                .extracting(Match::getId).containsExactly(missingTeams.getId(), live.getId());
        // PostgreSQL's descending null ordering remains the same as the previous derived query.
        assertThat(matchRepository.findRadarLast(competition.getId(), PageRequest.of(0, 5)))
                .extracting(Match::getId).containsExactly(undated.getId(), finished.getId());
    }

    @Test
    void membersAndFriendPredictionsAreLoadedInOneQueryPerLeague() {
        var competition = em.persist(Competition.builder().name("Friends test").build());
        var admin = em.persist(UserAccount.builder().googleEmail("admin@friends.test").googleName("Admin").participantName("Admin").build());
        var league = em.persist(League.builder().name("Friends league").joinCode("FRIEND").adminUser(admin).build());
        var other = em.persist(League.builder().name("Other league").joinCode("OTHERF").adminUser(admin).build());
        var edition = em.persist(Edition.builder().league(league).competition(competition).poolFormat(PoolFormat.MATCH_DAY).build());
        var otherEdition = em.persist(Edition.builder().league(other).competition(competition).poolFormat(PoolFormat.MATCH_DAY).build());
        var match = em.persist(Match.builder().competition(competition).build());
        for (int i = 0; i < 200; i++) {
            var user = em.persist(UserAccount.builder().googleEmail("friend" + i + "@test.com")
                    .googleName("Friend " + i).participantName("Friend " + i).build());
            em.persist(Membership.builder().id(new Membership.MembershipId(user.getId(), league.getId()))
                    .user(user).league(league).build());
            var prediction = em.persist(Prediction.builder().user(user).edition(i == 0 ? edition : otherEdition).name("Pick").build());
            em.persist(MatchPrediction.builder().prediction(prediction).match(match).predictionSign("X").build());
        }
        em.flush(); em.clear();
        var stats = statistics();
        var members = membershipRepository.findByLeagueId(league.getId());
        assertThat(members).hasSize(200);
        assertThat(members).allSatisfy(member -> assertThat(member.getUser().getParticipantName()).startsWith("Friend "));
        assertThat(stats.getPrepareStatementCount()).isEqualTo(1);
        em.clear(); stats.clear();
        var predictions = matchPredictionRepository.findFriendsByMatchAndLeague(match.getId(), league.getId());
        assertThat(predictions).hasSize(1);
        assertThat(predictions.get(0).getPrediction().getUser().getParticipantName()).isEqualTo("Friend 0");
        assertThat(stats.getPrepareStatementCount()).isEqualTo(1);
        assertThat(stats.getEntityLoadCount()).isLessThan(10);
    }
}
