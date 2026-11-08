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
import com.porra.mundial.service.sync.SyncService;
import com.porra.mundial.service.tournament.TopScorerService;
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

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Ligas que eligen sus partidos, con Postgres real. */
@SpringBootTest
@TestPropertySource(locations = "file:src/main/resources/application.properties",
        properties = "app.jwt.secret=match-selection-test-secret-0123456789-abcdefghij")
@Testcontainers(disabledWithoutDocker = true)
class MatchSelectionIntegrationTest {

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
    @Autowired private CompetitionRepository competitions;
    @Autowired private TeamRepository teams;
    @Autowired private MatchRepository matches;
    @Autowired private EditionRepository editions;
    @Autowired private PredictionRepository predictions;
    @Autowired private MatchPredictionRepository matchPredictions;
    @Autowired private UserAccountRepository users;

    private final Instant now = Instant.now();
    private Competition competition;
    private Team madrid;
    private Team betis;
    private Team celta;
    private Team getafe;
    private Match playedMadridBetis;
    private Match celtaGetafe;
    private Match madridCelta;
    private Match betisGetafe;

    @BeforeEach
    void calendar() {
        String key = UUID.randomUUID().toString().substring(0, 8);
        competition = competitions.save(Competition.builder().name("Liga " + key).externalId("sel." + key).build());
        madrid = team("Madrid " + key);
        betis = team("Betis " + key);
        celta = team("Celta " + key);
        getafe = team("Getafe " + key);
        playedMadridBetis = match(madrid, betis, "Jornada 1", now.minus(3, ChronoUnit.DAYS), true);
        celtaGetafe = match(celta, getafe, "Jornada 2", now.plus(2, ChronoUnit.DAYS), false);
        madridCelta = match(madrid, celta, "Jornada 2", now.plus(3, ChronoUnit.DAYS), false);
        betisGetafe = match(betis, getafe, "Jornada 3", now.plus(9, ChronoUnit.DAYS), false);
    }

    @Test
    @DisplayName("Una liga de un equipo ve solo sus partidos, también los que lleguen después")
    void followedTeamLeague() {
        UserAccount admin = user();
        League league = create(admin, new MatchSelectionRequest(MatchSelectionMode.CUSTOM, List.of(madrid.getId()),
                null, null));

        assertThat(fixtureIds(admin, league)).containsExactly(playedMadridBetis.getId(), madridCelta.getId());
        assertThat(leaderboardService.getMatchdayBreakdown(league.getId())).extracting(MatchdayPointsDTO::getLabel)
                .containsExactly("Jornada 1", "Jornada 2");

        // ESPN carga más tarde otro partido del equipo: entra solo.
        Match later = match(getafe, madrid, "Jornada 4", now.plus(16, ChronoUnit.DAYS), false);
        assertThat(fixtureIds(admin, league)).contains(later.getId()).doesNotContain(betisGetafe.getId());

        assertThatThrownBy(() -> predict(admin, league, celtaGetafe))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("no entra en esta liga");
    }

    @Test
    @DisplayName("Partidos elegidos a mano, y vuelta a todos")
    void handPickedMatches() {
        UserAccount admin = user();
        League league = create(admin, new MatchSelectionRequest(MatchSelectionMode.CUSTOM, null,
                List.of(celtaGetafe.getId(), betisGetafe.getId()), null));

        assertThat(fixtureIds(admin, league)).containsExactly(celtaGetafe.getId(), betisGetafe.getId());

        MatchSelectionDTO all = selectionService.update(league.getId(), admin.getGoogleEmail(),
                new MatchSelectionRequest(MatchSelectionMode.ALL, null, null, null));
        assertThat(all.mode()).isEqualTo("ALL");
        assertThat(all.matches()).allMatch(MatchSelectionDTO.Item::selected);
        assertThat(fixtureIds(admin, league)).hasSize(4);
    }

    @Test
    @DisplayName("Quitar un partido abierto borra sus predicciones; uno cerrado con predicciones se queda")
    void removingMatchesKeepsTheStandings() {
        UserAccount admin = user();
        League league = create(admin, null);
        predict(admin, league, madridCelta);
        // Una predicción ya puntuada de un partido terminado.
        Prediction prediction = predictions.findByUserGoogleEmailAndEditionLeagueId(admin.getGoogleEmail(),
                league.getId()).orElseThrow();
        matchPredictions.save(MatchPrediction.builder().prediction(prediction).match(playedMadridBetis)
                .homeScore(1).awayScore(0).predictionSign("1").pointsAwarded(3).build());
        int pointsBefore = leaderboardService.getLeaderboard(league.getId()).get(0).getTotal();
        assertThat(pointsBefore).isEqualTo(3);

        MatchSelectionDTO result = selectionService.update(league.getId(), admin.getGoogleEmail(),
                new MatchSelectionRequest(MatchSelectionMode.CUSTOM, null, List.of(betisGetafe.getId()), null));

        assertThat(result.keptMatches()).isEqualTo(1);
        assertThat(result.removedPredictions()).isEqualTo(1);
        assertThat(result.includedMatchIds()).containsExactlyInAnyOrder(betisGetafe.getId(), playedMadridBetis.getId());
        assertThat(result.matches()).filteredOn(item -> item.id().equals(playedMadridBetis.getId()))
                .singleElement().satisfies(item -> assertThat(item.locked()).isTrue());
        assertThat(matchPredictions.findByPredictionId(prediction.getId())).extracting(mp -> mp.getMatch().getId())
                .containsExactly(playedMadridBetis.getId());
        assertThat(leaderboardService.getLeaderboard(league.getId()).get(0).getTotal()).isEqualTo(pointsBefore);
    }

    @Test
    @DisplayName("Solo el administrador de una liga por jornadas oficial elige partidos")
    void onlyAdminsOfOfficialMatchdayLeagues() {
        UserAccount admin = user();
        League league = create(admin, null);
        UserAccount other = user();
        MatchSelectionRequest request = new MatchSelectionRequest(MatchSelectionMode.CUSTOM, List.of(madrid.getId()),
                null, null);

        assertThatThrownBy(() -> selectionService.update(league.getId(), other.getGoogleEmail(), request))
                .isInstanceOf(BusinessException.class).hasMessageContaining("administrador");

        League survivor = leagueSetupService.create(new NewLeague("Superviviente", admin.getGoogleEmail(),
                competition.getId(), PoolFormat.SURVIVOR, false, null, null), LeagueSetup.NONE);
        assertThatThrownBy(() -> selectionService.update(survivor.getId(), admin.getGoogleEmail(), request))
                .isInstanceOf(BusinessException.class).hasMessageContaining("jornadas");

        Team stranger = teams.save(Team.builder().name("Otro " + UUID.randomUUID()).build());
        assertThatThrownBy(() -> selectionService.update(league.getId(), admin.getGoogleEmail(),
                new MatchSelectionRequest(MatchSelectionMode.CUSTOM, List.of(stranger.getId()), null, null)))
                .isInstanceOf(BusinessException.class).hasMessageContaining("equipo");
        Edition edition = editions.findByLeagueIdAndStatus(league.getId(), "ACTIVE").orElseThrow();
        assertThat(edition.getMatchSelection()).isEqualTo(MatchSelectionMode.ALL);
    }

    @Test
    @DisplayName("Con cierre por jornada, la jornada es la de la liga y quitar partidos no reabre ninguno predicho")
    void perRoundLockFollowsTheLeagueWithoutReopening() {
        // Jornada 5: uno ya empezado y otro mañana, cerrado porque la jornada empezó.
        Match started = match(celta, betis, "Jornada 5", now.minus(1, ChronoUnit.HOURS), false);
        Match tomorrow = match(madrid, getafe, "Jornada 5", now.plus(1, ChronoUnit.DAYS), false);
        UserAccount admin = user();

        // Liga nueva del Madrid: la jornada 5 empieza mañana con su partido.
        League club = create(admin, new MatchSelectionRequest(MatchSelectionMode.CUSTOM, List.of(madrid.getId()),
                null, null));
        perRound(club);
        predict(admin, club, tomorrow);

        // Liga de todos: el partido de mañana ya está cerrado y alguien lo predijo antes.
        League all = create(admin, null);
        perRound(all);
        Prediction prediction = predictions.save(Prediction.builder().user(admin)
                .edition(editions.findByLeagueIdAndStatus(all.getId(), "ACTIVE").orElseThrow())
                .name("Ana").createdAt(now).build());
        matchPredictions.save(MatchPrediction.builder().prediction(prediction).match(tomorrow)
                .homeScore(1).awayScore(1).predictionSign("X").build());

        MatchSelectionDTO result = selectionService.update(all.getId(), admin.getGoogleEmail(),
                new MatchSelectionRequest(MatchSelectionMode.CUSTOM, List.of(madrid.getId()), null, null));

        // Quitar el ya empezado reabriría el de mañana: se queda.
        assertThat(result.keptMatches()).isEqualTo(1);
        assertThat(result.matches()).filteredOn(MatchSelectionDTO.Item::selected).extracting(MatchSelectionDTO.Item::id)
                .contains(started.getId(), tomorrow.getId());
        assertThat(matchPredictions.findByPredictionId(prediction.getId())).hasSize(1);
    }

    private void perRound(League league) {
        Edition edition = editions.findByLeagueIdAndStatus(league.getId(), "ACTIVE").orElseThrow();
        edition.setLockMode(com.porra.mundial.model.PredictionLockMode.PER_ROUND);
        editions.save(edition);
    }

    private League create(UserAccount admin, MatchSelectionRequest selection) {
        return leagueSetupService.create(new NewLeague("Peña", admin.getGoogleEmail(), competition.getId(),
                PoolFormat.MATCH_DAY, false, null, null),
                new LeagueSetup(null, null, null, null, null, null, selection));
    }

    private List<Long> fixtureIds(UserAccount user, League league) {
        return matchPredictionService.getMatchdayFixtures(user.getGoogleEmail(), league.getId(), null).stream()
                .map(MatchdayFixturePredictionDTO::getMatchId).toList();
    }

    private void predict(UserAccount user, League league, Match match) {
        MatchPredictionItemDTO item = new MatchPredictionItemDTO();
        item.setMatchId(match.getId());
        item.setHomeScore(2);
        item.setAwayScore(1);
        matchPredictionService.saveMatchdayPredictions(user.getGoogleEmail(), league.getId(), List.of(item));
    }

    private Team team(String name) {
        return teams.save(Team.builder().name(name).competition(competition).build());
    }

    private Match match(Team home, Team away, String round, Instant date, boolean finished) {
        return matches.save(Match.builder().competition(competition).homeTeam(home).awayTeam(away).round(round)
                .matchDate(date).finished(finished).homeScore(finished ? 1 : null).awayScore(finished ? 0 : null)
                .status(finished ? MatchStatusNormalized.FINISHED : MatchStatusNormalized.SCHEDULED)
                .externalId("sel-" + UUID.randomUUID()).build());
    }

    private UserAccount user() {
        String email = "sel-" + UUID.randomUUID() + "@test.invalid";
        return users.save(UserAccount.builder().googleEmail(email).googleName("Ana").participantName("Ana").build());
    }
}
