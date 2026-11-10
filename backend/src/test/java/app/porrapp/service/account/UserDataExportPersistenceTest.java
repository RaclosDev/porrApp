package app.porrapp.service.account;

import app.porrapp.dto.UserDataExport;
import app.porrapp.model.Competition;
import app.porrapp.model.Edition;
import app.porrapp.model.League;
import app.porrapp.model.Membership;
import app.porrapp.model.PoolFormat;
import app.porrapp.model.Prediction;
import app.porrapp.model.PushNotificationLog;
import app.porrapp.model.PushSubscription;
import app.porrapp.model.ScoreDay;
import app.porrapp.model.ScoreGame;
import app.porrapp.model.ScoreTrackerPlayer;
import app.porrapp.model.ScoreTrackerRound;
import app.porrapp.model.ScoreTrackerScore;
import app.porrapp.model.ScoreTrackerSession;
import app.porrapp.model.UserAccount;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.jpa.test.autoconfigure.TestEntityManager;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Import;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers(disabledWithoutDocker = true)
@Import(UserDataExportService.class)
class UserDataExportPersistenceTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired private TestEntityManager em;
    @Autowired private UserDataExportService exports;

    @Test
    void exportContainsOnlyTheUsersOwnDataAndNoPushKeys() {
        UserAccount ana = em.persist(UserAccount.builder().googleEmail("export-ana@test.invalid")
                .participantName("Ana").build());
        UserAccount other = em.persist(UserAccount.builder().googleEmail("export-other@test.invalid")
                .participantName("Otro").build());
        Competition competition = em.getEntityManager().createQuery(
                        "select c from Competition c where c.externalId = :id", Competition.class)
                .setParameter("id", Competition.WORLD_CUP_EXTERNAL_ID).getSingleResult();
        League league = em.persist(League.builder().name("Export League").joinCode("TESTEXP1")
                .adminUser(other).build());
        Edition edition = em.persist(Edition.builder().league(league).competition(competition)
                .poolFormat(PoolFormat.KNOCKOUTS_ONLY).build());
        for (UserAccount u : new UserAccount[]{ana, other}) {
            em.persist(Membership.builder().id(new Membership.MembershipId(u.getId(), league.getId()))
                    .user(u).league(league).build());
            em.persist(Prediction.builder().user(u).edition(edition).name(u.getParticipantName())
                    .paymentStatus("PENDING").build());
        }
        em.persist(PushSubscription.builder().user(ana).endpoint("https://push.test/ana")
                .p256dh("secret-key").auth("secret-auth").build());
        em.persist(PushNotificationLog.builder().userId(ana.getId()).title("Te faltan 2 predicciones")
                .body("Export League").url("/jornadas").build());
        em.persist(PushNotificationLog.builder().userId(other.getId()).title("Aviso de Otro")
                .body("Export League").build());
        em.flush();
        em.clear();

        UserDataExport export = exports.export("export-ana@test.invalid");

        assertThat(export.profile().email()).isEqualTo("export-ana@test.invalid");
        assertThat(export.profile().participantName()).isEqualTo("Ana");
        assertThat(export.leagues()).singleElement()
                .satisfies(l -> assertThat(l.leagueName()).isEqualTo("Export League"));
        assertThat(export.predictions()).singleElement()
                .satisfies(p -> assertThat(p.name()).isEqualTo("Ana"));
        assertThat(export.pushDevices()).hasSize(1);
        assertThat(export.pushNotifications()).singleElement()
                .satisfies(n -> assertThat(n.title()).isEqualTo("Te faltan 2 predicciones"));
        assertThat(export.toString()).doesNotContain("Otro", "secret-key", "secret-auth", "push.test");
    }

    @Test
    void exportIncludesTheUsersOwnBoardGamePlayerButNotTheOthers() {
        UserAccount ana = em.persist(UserAccount.builder().googleEmail("board-ana@test.invalid")
                .participantName("Ana").build());
        League league = em.persist(League.builder().name("Juegos de mesa").joinCode("TESTBRD1")
                .adminUser(ana).kind(League.KIND_SCOREBOARD).build());
        em.persist(Membership.builder().id(new Membership.MembershipId(ana.getId(), league.getId()))
                .user(ana).league(league).build());
        ScoreGame game = em.persist(ScoreGame.builder().leagueId(league.getId()).name("Catán").build());
        ScoreTrackerPlayer mine = em.persist(ScoreTrackerPlayer.builder().leagueId(league.getId()).name("Ana")
                .position(0).userId(ana.getId()).build());
        ScoreTrackerPlayer guest = em.persist(ScoreTrackerPlayer.builder().leagueId(league.getId()).name("Invitada")
                .position(1).build());
        ScoreDay day = em.persist(ScoreDay.builder().leagueId(league.getId()).build());
        ScoreTrackerSession session = em.persist(ScoreTrackerSession.builder().leagueId(league.getId())
                .gameId(game.getId()).dayId(day.getId()).build());
        for (int points : new int[]{3, 5}) {
            ScoreTrackerRound round = em.persist(ScoreTrackerRound.builder().leagueId(league.getId())
                    .sessionId(session.getId()).build());
            em.persist(new ScoreTrackerScore(round.getId(), mine.getId(), points));
            em.persist(new ScoreTrackerScore(round.getId(), guest.getId(), 99));
        }
        em.flush();
        em.clear();

        UserDataExport export = exports.export("board-ana@test.invalid");

        assertThat(export.boardGames()).singleElement().satisfies(p -> {
            assertThat(p.leagueId()).isEqualTo(league.getId());
            assertThat(p.name()).isEqualTo("Ana");
            assertThat(p.roundsPlayed()).isEqualTo(2);
            assertThat(p.totalPoints()).isEqualTo(8);
        });
        assertThat(export.toString()).doesNotContain("Invitada");
    }
}
