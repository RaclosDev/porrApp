package com.porra.mundial;

import com.porra.mundial.config.DataInitializer;
import com.porra.mundial.dto.MatchPredictionItemDTO;
import com.porra.mundial.dto.MatchSelectionDTO;
import com.porra.mundial.dto.MatchSelectionRequest;
import com.porra.mundial.dto.MatchdayFixturePredictionDTO;
import com.porra.mundial.dto.MatchdayPointsDTO;
import com.porra.mundial.exception.BusinessException;
import com.porra.mundial.model.Competition;
import com.porra.mundial.model.Edition;
import com.porra.mundial.model.League;
import com.porra.mundial.model.Match;
import com.porra.mundial.model.MatchPrediction;
import com.porra.mundial.model.MatchSelectionMode;
import com.porra.mundial.model.MatchStatusNormalized;
import com.porra.mundial.model.PoolFormat;
import com.porra.mundial.model.Prediction;
import com.porra.mundial.model.PredictionLockMode;
import com.porra.mundial.model.Team;
import com.porra.mundial.model.UserAccount;
import com.porra.mundial.repository.CompetitionRepository;
import com.porra.mundial.repository.EditionRepository;
import com.porra.mundial.repository.MatchPredictionRepository;
import com.porra.mundial.repository.MatchRepository;
import com.porra.mundial.repository.PredictionRepository;
import com.porra.mundial.repository.TeamRepository;
import com.porra.mundial.repository.UserAccountRepository;
import com.porra.mundial.service.league.LeagueSetup;
import com.porra.mundial.service.league.LeagueSetupService;
import com.porra.mundial.service.league.NewLeague;
import com.porra.mundial.service.prediction.LeaderboardService;
import com.porra.mundial.service.prediction.MatchPredictionService;
import com.porra.mundial.service.prediction.MatchSelectionService;
import com.porra.mundial.service.prediction.ScoreInvalidationService;
import com.porra.mundial.service.sync.SyncService;
import com.porra.mundial.service.tournament.TopScorerService;
import com.porra.mundial.util.AppTime;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Ligas por jornadas que juntan partidos sueltos de varias competiciones oficiales, con Postgres real. */
@SpringBootTest
@TestPropertySource(locations = "file:src/main/resources/application.properties",
        properties = "app.jwt.secret=multi-competition-test-secret-0123456789-abcdefghij")
@Testcontainers(disabledWithoutDocker = true)
class MultiCompetitionLeagueIntegrationTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    @MockitoBean private DataInitializer dataInitializer;
    @MockitoBean private TopScorerService topScorerService;
    @MockitoBean private SyncService syncService;

    @Autowired private LeagueSetupService leagueSetupService;
    @Autowired private MatchSelectionService selectionService;
    @Autowired private MatchPredictionService matchPredictionService;
    @Autowired private LeaderboardService leaderboardService;
    @Autowired private ScoreInvalidationService scoreInvalidationService;
    @Autowired private CompetitionRepository competitions;
    @Autowired private TeamRepository teams;
    @Autowired private MatchRepository matches;
    @Autowired private EditionRepository editions;
    @Autowired private PredictionRepository predictions;
    @Autowired private MatchPredictionRepository matchPredictions;
    @Autowired private UserAccountRepository users;

    private Competition laliga;
    private Competition champions;
    private Competition premier;
    private Team madrid;
    private Team barcelona;
    private Team arsenal;
    private Team tottenham;
    private Team inter;
    /** Lunes de la semana que viene y de la siguiente (hora peninsular). */
    private LocalDate week1;
    private LocalDate week2;
    private Match clasico;
    private Match derby;
    private Match championsTuesday;
    private Match laligaNextWeek;
    private Match laligaOther;

    @BeforeEach
    void calendar() {
        String key = UUID.randomUUID().toString().substring(0, 8);
        laliga = competition("LaLiga " + key, "mc-esp." + key);
        champions = competition("Champions " + key, "mc-uefa." + key);
        premier = competition("Premier " + key, "mc-eng." + key);
        // Los equipos son los mismos en todas las competiciones (como los de ESPN).
        madrid = team("Real Madrid " + key);
        barcelona = team("Barcelona " + key);
        arsenal = team("Arsenal " + key);
        tottenham = team("Tottenham " + key);
        inter = team("Inter " + key);
        week1 = AppTime.day(Instant.now()).with(TemporalAdjusters.next(DayOfWeek.MONDAY));
        week2 = week1.plusWeeks(1);

        // Misma etiqueta «Jornada 12» en LaLiga y en la Premier, y «Jornada 4» en la Champions.
        championsTuesday = match(champions, inter, madrid, "Jornada 4", at(week1.plusDays(1), 21));
        clasico = match(laliga, madrid, barcelona, "Jornada 12", at(week1.plusDays(5), 21));
        derby = match(premier, arsenal, tottenham, "Jornada 12", at(week2.plusDays(6), 17));
        laligaNextWeek = match(laliga, barcelona, madrid, "Jornada 13", at(week2.plusDays(5), 18));
        laligaOther = match(laliga, barcelona, team("Getafe " + key), "Jornada 12", at(week1.plusDays(6), 14));
    }

    @Test
    @DisplayName("Partidos sueltos de tres competiciones, agrupados por semana y no por la jornada de cada una")
    void looseMatchesGroupedByWeek() {
        UserAccount admin = user();
        League league = create(admin, pick(List.of(laliga, champions, premier), clasico, championsTuesday, derby));

        Edition edition = edition(league);
        assertThat(edition.isMultiCompetition()).isTrue();
        assertThat(edition.getCompetition().getId()).isEqualTo(laliga.getId());

        List<MatchdayFixturePredictionDTO> fixtures = fixtures(admin, league, null);
        assertThat(fixtures).extracting(MatchdayFixturePredictionDTO::getMatchId)
                .containsExactly(championsTuesday.getId(), clasico.getId(), derby.getId());
        assertThat(fixtures).extracting(MatchdayFixturePredictionDTO::getRound)
                .containsExactly("Semana " + week1, "Semana " + week1, "Semana " + week2);
        assertThat(fixtures).extracting(MatchdayFixturePredictionDTO::getCompetitionName)
                .containsExactly(champions.getName(), laliga.getName(), premier.getName());

        // La «Jornada 12» de LaLiga y la de la Premier no se juntan: cada una cae en su semana.
        assertThat(leaderboardService.getMatchdayBreakdown(league.getId())).extracting(MatchdayPointsDTO::getLabel)
                .containsExactly("Semana " + week1, "Semana " + week2);
        assertThat(fixtures(admin, league, "Semana " + week1)).extracting(MatchdayFixturePredictionDTO::getMatchId)
                .containsExactly(championsTuesday.getId(), clasico.getId());

        predict(admin, league, championsTuesday);
        predict(admin, league, derby);
        assertThatThrownBy(() -> predict(admin, league, laligaOther))
                .isInstanceOf(BusinessException.class).hasMessageContaining("no entra en esta liga");
        Competition copa = competition("Copa " + UUID.randomUUID(), "mc-copa." + UUID.randomUUID());
        Match copaMatch = match(copa, madrid, inter, "r16", at(week1.plusDays(2), 21));
        assertThatThrownBy(() -> predict(admin, league, copaMatch))
                .isInstanceOf(BusinessException.class).hasMessageContaining("no pertenece");
    }

    @Test
    @DisplayName("Siguiendo a un equipo entran sus partidos de todas las competiciones de la liga")
    void followedTeamAcrossCompetitions() {
        UserAccount admin = user();
        League league = create(admin, new MatchSelectionRequest(MatchSelectionMode.CUSTOM, List.of(madrid.getId()),
                null, null, List.of(laliga.getId(), champions.getId())));

        assertThat(fixtures(admin, league, null)).extracting(MatchdayFixturePredictionDTO::getMatchId)
                .containsExactly(championsTuesday.getId(), clasico.getId(), laligaNextWeek.getId());
    }

    @Test
    @DisplayName("Con cierre por jornada, la semana se cierra con su primer partido, sea de la competición que sea")
    void perRoundLockClosesTheWholeWeek() {
        UserAccount admin = user();
        League league = create(admin, pick(List.of(laliga, champions), clasico, championsTuesday, laligaNextWeek));
        Edition edition = edition(league);
        edition.setLockMode(PredictionLockMode.PER_ROUND);
        edition.setLockOffsetMinutes(0);
        editions.save(edition);

        List<MatchdayFixturePredictionDTO> fixtures = fixtures(admin, league, null);
        assertThat(lockAt(fixtures, clasico)).isEqualTo(championsTuesday.getMatchDate());
        assertThat(lockAt(fixtures, laligaNextWeek)).isEqualTo(laligaNextWeek.getMatchDate());
    }

    @Test
    @DisplayName("En la administración se añaden competiciones; quitar una borra solo predicciones abiertas")
    void adminAddsAndRemovesCompetitions() {
        UserAccount admin = user();
        League league = create(admin, new MatchSelectionRequest(MatchSelectionMode.CUSTOM, null,
                List.of(clasico.getId()), null));
        assertThat(edition(league).isMultiCompetition()).isFalse();

        MatchSelectionDTO added = selectionService.update(league.getId(), admin.getGoogleEmail(),
                pick(List.of(laliga, premier), clasico, derby));
        assertThat(added.competitionIds()).containsExactly(laliga.getId(), premier.getId());
        assertThat(added.competitions()).extracting(MatchSelectionDTO.CompetitionItem::name)
                .containsExactly(laliga.getName(), premier.getName());
        assertThat(added.matches()).filteredOn(MatchSelectionDTO.Item::selected)
                .extracting(MatchSelectionDTO.Item::round)
                .containsExactly("Semana " + week1, "Semana " + week2);
        assertThat(edition(league).isMultiCompetition()).isTrue();

        predict(admin, league, derby);
        MatchSelectionDTO view = selectionService.view(league.getId(), admin.getGoogleEmail());
        assertThat(view.competitions()).noneMatch(MatchSelectionDTO.CompetitionItem::locked);

        // Sin la Premier vuelve a ser de una competición: el derbi, aún abierto, sale con su predicción.
        MatchSelectionDTO removed = selectionService.update(league.getId(), admin.getGoogleEmail(),
                new MatchSelectionRequest(MatchSelectionMode.CUSTOM, null, List.of(clasico.getId()), null,
                        List.of(laliga.getId())));
        assertThat(removed.removedPredictions()).isEqualTo(1);
        assertThat(removed.competitionIds()).containsExactly(laliga.getId());
        assertThat(edition(league).isMultiCompetition()).isFalse();
        assertThat(fixtures(admin, league, null)).extracting(MatchdayFixturePredictionDTO::getRound)
                .containsExactly("Jornada 12");
    }

    @Test
    @DisplayName("Una competición con partidos cerrados y con predicciones no se puede quitar")
    void competitionWithClosedPredictionsStays() {
        Match played = match(premier, tottenham, arsenal, "Jornada 10", Instant.now().minus(2, ChronoUnit.DAYS));
        played.setFinished(true);
        played.setHomeScore(2);
        played.setAwayScore(0);
        played.setStatus(MatchStatusNormalized.FINISHED);
        matches.save(played);
        UserAccount admin = user();
        League league = create(admin, pick(List.of(laliga, premier), clasico, played));
        Prediction prediction = predictions.save(Prediction.builder().user(admin).edition(edition(league))
                .name("Ana").createdAt(Instant.now()).build());
        matchPredictions.save(MatchPrediction.builder().prediction(prediction).match(played)
                .homeScore(2).awayScore(0).predictionSign("1").pointsAwarded(3).build());

        MatchSelectionDTO view = selectionService.view(league.getId(), admin.getGoogleEmail());
        assertThat(view.competitions()).filteredOn(item -> item.id().equals(premier.getId()))
                .singleElement().satisfies(item -> assertThat(item.locked()).isTrue());

        assertThatThrownBy(() -> selectionService.update(league.getId(), admin.getGoogleEmail(),
                new MatchSelectionRequest(MatchSelectionMode.CUSTOM, null, List.of(clasico.getId()), null,
                        List.of(laliga.getId()))))
                .isInstanceOf(BusinessException.class).hasMessageContaining("No puedes quitar " + premier.getName());
        assertThat(matchPredictions.findByPredictionId(prediction.getId())).hasSize(1);

        // Recalcular la competición también marca las porras de las ligas que la juntan con otras.
        assertThat(leaderboardService.getLeaderboard(league.getId()).get(0).getTotal()).isEqualTo(3);
        assertThat(scoreInvalidationService.invalidateCompetition(premier.getId())).isEqualTo(1);
    }

    @Test
    @DisplayName("Varias competiciones solo con partidos elegidos, oficiales y del mismo deporte")
    void validatesCompetitions() {
        UserAccount admin = user();
        League league = create(admin, null);
        String email = admin.getGoogleEmail();

        assertThatThrownBy(() -> selectionService.update(league.getId(), email, new MatchSelectionRequest(
                MatchSelectionMode.ALL, null, null, null, List.of(laliga.getId(), premier.getId()))))
                .isInstanceOf(BusinessException.class).hasMessageContaining("elige los equipos o los partidos");

        Competition lol = competition("Worlds " + UUID.randomUUID(), "lol.mc-" + UUID.randomUUID());
        assertThatThrownBy(() -> selectionService.update(league.getId(), email, new MatchSelectionRequest(
                MatchSelectionMode.CUSTOM, null, List.of(clasico.getId()), null, List.of(laliga.getId(), lol.getId()))))
                .isInstanceOf(BusinessException.class).hasMessageContaining("mismo deporte");

        assertThatThrownBy(() -> selectionService.update(league.getId(), email, new MatchSelectionRequest(
                MatchSelectionMode.CUSTOM, null, List.of(laligaNextWeek.getId(), derby.getId()), null,
                List.of(laliga.getId()))))
                .isInstanceOf(BusinessException.class).hasMessageContaining("partido");

        assertThat(edition(league).getMatchSelection()).isEqualTo(MatchSelectionMode.ALL);
        assertThat(edition(league).isMultiCompetition()).isFalse();
    }

    @Test
    @DisplayName("El calendario para crear la liga junta las competiciones elegidas por semanas")
    void wizardCalendar() {
        MatchSelectionDTO calendar = selectionService.competitionCalendar(List.of(laliga.getId(), champions.getId()));

        assertThat(calendar.competitionIds()).containsExactly(laliga.getId(), champions.getId());
        assertThat(calendar.matches()).extracting(MatchSelectionDTO.Item::id)
                .containsExactly(championsTuesday.getId(), clasico.getId(), laligaOther.getId(), laligaNextWeek.getId());
        assertThat(calendar.matches()).extracting(MatchSelectionDTO.Item::round)
                .containsExactly("Semana " + week1, "Semana " + week1, "Semana " + week1, "Semana " + week2);
        assertThat(calendar.matches()).extracting(MatchSelectionDTO.Item::competitionId)
                .containsExactly(champions.getId(), laliga.getId(), laliga.getId(), laliga.getId());
    }

    private static MatchSelectionRequest pick(List<Competition> competitions, Match... picked) {
        return new MatchSelectionRequest(MatchSelectionMode.CUSTOM, null,
                java.util.Arrays.stream(picked).map(Match::getId).toList(), null,
                competitions.stream().map(Competition::getId).toList());
    }

    private League create(UserAccount admin, MatchSelectionRequest selection) {
        return leagueSetupService.create(new NewLeague("Peña", admin.getGoogleEmail(), laliga.getId(),
                PoolFormat.MATCH_DAY, false, null, null),
                new LeagueSetup(null, null, null, null, null, null, selection));
    }

    private Edition edition(League league) {
        return editions.findByLeagueIdAndStatus(league.getId(), "ACTIVE").orElseThrow();
    }

    private List<MatchdayFixturePredictionDTO> fixtures(UserAccount user, League league, String round) {
        return matchPredictionService.getMatchdayFixtures(user.getGoogleEmail(), league.getId(), round);
    }

    private static Instant lockAt(List<MatchdayFixturePredictionDTO> fixtures, Match match) {
        return fixtures.stream().filter(fixture -> fixture.getMatchId().equals(match.getId()))
                .findFirst().orElseThrow().getLockAt();
    }

    private void predict(UserAccount user, League league, Match match) {
        MatchPredictionItemDTO item = new MatchPredictionItemDTO();
        item.setMatchId(match.getId());
        item.setHomeScore(2);
        item.setAwayScore(1);
        matchPredictionService.saveMatchdayPredictions(user.getGoogleEmail(), league.getId(), List.of(item));
    }

    private static Instant at(LocalDate day, int hour) {
        return AppTime.fromLocal(day.atTime(LocalTime.of(hour, 0)));
    }

    private Competition competition(String name, String externalId) {
        return competitions.save(Competition.builder().name(name).externalId(externalId).build());
    }

    private Team team(String name) {
        return teams.save(Team.builder().name(name).build());
    }

    private Match match(Competition competition, Team home, Team away, String round, Instant date) {
        return matches.save(Match.builder().competition(competition).homeTeam(home).awayTeam(away).round(round)
                .matchDate(date).finished(false).status(MatchStatusNormalized.SCHEDULED)
                .externalId("mc-" + UUID.randomUUID()).build());
    }

    private UserAccount user() {
        String email = "mc-" + UUID.randomUUID() + "@test.invalid";
        return users.save(UserAccount.builder().googleEmail(email).googleName("Ana").participantName("Ana").build());
    }
}
