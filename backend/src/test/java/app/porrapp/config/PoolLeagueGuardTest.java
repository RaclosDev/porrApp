package app.porrapp.config;

import app.porrapp.controller.CustomCompetitionController;
import app.porrapp.controller.GrandPrixController;
import app.porrapp.controller.LeaderboardController;
import app.porrapp.controller.LeagueController;
import app.porrapp.controller.LeagueScoringController;
import app.porrapp.controller.MatchPredictionController;
import app.porrapp.controller.MatchSelectionController;
import app.porrapp.controller.MatchdayStatsController;
import app.porrapp.controller.PredictionController;
import app.porrapp.controller.ScorerPickController;
import app.porrapp.model.League;
import app.porrapp.repository.LeagueRepository;
import app.porrapp.repository.UserAccountRepository;
import app.porrapp.service.formulaone.FormulaOneStandingsService;
import app.porrapp.service.formulaone.GrandPrixService;
import app.porrapp.service.league.LeagueMembershipService;
import app.porrapp.service.league.LeagueRepeatService;
import app.porrapp.service.league.LeagueScoringService;
import app.porrapp.service.league.LeagueService;
import app.porrapp.service.league.LeagueSetupService;
import app.porrapp.service.league.LeagueSummaryService;
import app.porrapp.service.league.ScorerPickService;
import app.porrapp.service.notification.WebSocketService;
import app.porrapp.service.prediction.CustomCompetitionService;
import app.porrapp.service.prediction.LeaderboardService;
import app.porrapp.service.prediction.MatchPredictionService;
import app.porrapp.service.prediction.MatchSelectionService;
import app.porrapp.service.prediction.MatchdayStatsService;
import app.porrapp.service.prediction.PredictionService;
import app.porrapp.service.sync.OnDemandCompetitionImport;
import app.porrapp.service.tournament.OfficialCompetitionLinkService;
import app.porrapp.sports.EspnNbaDataProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.HttpMethod;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Ninguna ruta de porra llega a su servicio (ni responde 500) cuando la liga es de juegos de mesa. */
@WebMvcTest({PredictionController.class, LeaderboardController.class, MatchdayStatsController.class,
        MatchPredictionController.class, GrandPrixController.class, CustomCompetitionController.class,
        MatchSelectionController.class, LeagueScoringController.class, ScorerPickController.class,
        LeagueController.class})
@AutoConfigureMockMvc(addFilters = false)
@MockitoBean(types = {UserAccountRepository.class, JwtUtil.class, WebSocketService.class, LeagueService.class,
        LeagueSetupService.class, LeagueMembershipService.class, LeagueSummaryService.class,
        FormulaOneStandingsService.class, OfficialCompetitionLinkService.class, EspnNbaDataProvider.class,
        OnDemandCompetitionImport.class})
class PoolLeagueGuardTest {

    private static final long BOARD_GAMES = 7L;
    private static final long POOL = 8L;

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private LeagueRepository leagueRepository;
    @MockitoBean
    private PredictionService predictionService;
    @MockitoBean
    private LeaderboardService leaderboardService;
    @MockitoBean
    private MatchdayStatsService matchdayStatsService;
    @MockitoBean
    private MatchPredictionService matchPredictionService;
    @MockitoBean
    private GrandPrixService grandPrixService;
    @MockitoBean
    private CustomCompetitionService customCompetitionService;
    @MockitoBean
    private MatchSelectionService matchSelectionService;
    @MockitoBean
    private LeagueScoringService leagueScoringService;
    @MockitoBean
    private ScorerPickService scorerPickService;
    @MockitoBean
    private LeagueRepeatService leagueRepeatService;

    @BeforeEach
    void leagues() {
        when(leagueRepository.findById(BOARD_GAMES)).thenReturn(Optional.of(
                League.builder().id(BOARD_GAMES).name("Juegos").kind(League.KIND_SCOREBOARD).build()));
        when(leagueRepository.findById(POOL)).thenReturn(Optional.of(
                League.builder().id(POOL).name("Porra").kind(League.KIND_POOL).build()));
    }

    @ParameterizedTest(name = "{0} {1}")
    @CsvSource({
            "GET, /api/predictions?groupId=7",
            "POST, /api/predictions?groupId=7",
            "GET, /api/predictions/matchday?groupId=7&round=1",
            "POST, /api/predictions/matchday?groupId=7",
            "GET, /api/predictions/matchday/survivor?groupId=7",
            "GET, /api/predictions/matchday/matches/5/predictions?groupId=7",
            "GET, /api/predictions/matchday/stats?groupId=7",
            "GET, /api/predictions/matchday/stats/voters?groupId=7&matchIds=1",
            "GET, /api/leaderboard?groupId=7",
            "GET, /api/leaderboard/logs?groupId=7",
            "GET, /api/leaderboard/matchdays?groupId=7",
            "GET, /api/grand-prix?groupId=7",
            "GET, /api/grand-prix/standings?groupId=7",
            "GET, /api/grand-prix/picks?groupId=7",
            "GET, /api/groups/7/competition/teams",
            "GET, /api/groups/7/competition/matches",
            "POST, /api/groups/7/competition/matches",
            "GET, /api/groups/7/competition/standings",
            "GET, /api/groups/7/competition/lock-state",
            "GET, /api/groups/7/competition/match-selection",
            "PUT, /api/groups/7/competition/match-selection",
            "GET, /api/groups/7/scoring",
            "PUT, /api/groups/7/scoring",
            "POST, /api/groups/7/repeat",
            "GET, /api/groups/7/scorer-pick",
            "PUT, /api/groups/7/scorer-pick",
            "GET, /api/groups/7/scorer-picks",
    })
    void poolRoutesRejectABoardGamesLeagueBeforeReachingTheirService(String method, String url) throws Exception {
        mockMvc.perform(request(HttpMethod.valueOf(method), url).principal(() -> "ana@x.com"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value(PoolLeagueGuard.MESSAGE));

        verifyNoInteractions(predictionService, leaderboardService, matchdayStatsService, matchPredictionService,
                grandPrixService, customCompetitionService, matchSelectionService, leagueScoringService,
                scorerPickService, leagueRepeatService);
    }

    @Test
    void aPoolLeagueGoesThrough() throws Exception {
        mockMvc.perform(request(HttpMethod.GET, "/api/groups/8/scoring").principal(() -> "ana@x.com"))
                .andExpect(status().isOk());

        verify(leagueScoringService).getScoring(eq(POOL), any());
    }

    @Test
    void readsTheLeagueFromThePathOrTheGroupIdParameter() {
        MockHttpServletRequest byPath = new MockHttpServletRequest("GET", "/api/groups/12/scoring");
        MockHttpServletRequest byParam = new MockHttpServletRequest("GET", "/api/leaderboard");
        byParam.setParameter("groupId", "13");
        MockHttpServletRequest garbage = new MockHttpServletRequest("GET", "/api/leaderboard");
        garbage.setParameter("groupId", "abc");

        assertThat(PoolLeagueGuard.leagueId(byPath)).contains(12L);
        assertThat(PoolLeagueGuard.leagueId(byParam)).contains(13L);
        assertThat(PoolLeagueGuard.leagueId(garbage)).isEmpty();
        assertThat(PoolLeagueGuard.leagueId(new MockHttpServletRequest("GET", "/api/predictions/4"))).isEmpty();
    }
}
