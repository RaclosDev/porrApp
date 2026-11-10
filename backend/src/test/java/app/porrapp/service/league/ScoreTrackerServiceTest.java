package app.porrapp.service.league;

import app.porrapp.dto.ScoreGameNameRequest;
import app.porrapp.dto.ScoreGameRequest;
import app.porrapp.dto.ScoreTrackerDTO;
import app.porrapp.dto.ScoreTrackerDTO.Standing;
import app.porrapp.dto.ScoreTrackerRequest;
import app.porrapp.dto.ScoreTrackerRoundRequest;
import app.porrapp.exception.BusinessException;
import app.porrapp.model.League;
import app.porrapp.model.Membership;
import app.porrapp.model.ScoreDay;
import app.porrapp.model.ScoreDayPlayer;
import app.porrapp.model.ScoreGame;
import app.porrapp.model.ScoreSessionPlayer;
import app.porrapp.model.ScoreTrackerPlayer;
import app.porrapp.model.ScoreTrackerRound;
import app.porrapp.model.ScoreTrackerScore;
import app.porrapp.model.ScoreTrackerSession;
import app.porrapp.model.UserAccount;
import app.porrapp.repository.LeagueRepository;
import app.porrapp.repository.MembershipRepository;
import app.porrapp.repository.ScoreDayPlayerRepository;
import app.porrapp.repository.ScoreDayRepository;
import app.porrapp.repository.ScoreGameRepository;
import app.porrapp.repository.ScoreSessionPlayerRepository;
import app.porrapp.repository.ScoreTrackerPlayerRepository;
import app.porrapp.repository.ScoreTrackerRoundRepository;
import app.porrapp.repository.ScoreTrackerScoreRepository;
import app.porrapp.repository.ScoreTrackerSessionRepository;
import app.porrapp.repository.UserAccountRepository;
import app.porrapp.service.notification.WebSocketService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.assertj.core.groups.Tuple;
import org.mockito.ArgumentCaptor;

import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeast;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ScoreTrackerServiceTest {

    private final LeagueRepository leagues = mock(LeagueRepository.class);
    private final MembershipRepository memberships = mock(MembershipRepository.class);
    private final LeagueMembershipService membershipService = mock(LeagueMembershipService.class);
    private final LeagueService leagueService = mock(LeagueService.class);
    private final ScoreGameRepository games = mock(ScoreGameRepository.class);
    private final ScoreTrackerPlayerRepository players = mock(ScoreTrackerPlayerRepository.class);
    private final ScoreTrackerSessionRepository sessions = mock(ScoreTrackerSessionRepository.class);
    private final ScoreTrackerRoundRepository rounds = mock(ScoreTrackerRoundRepository.class);
    private final ScoreTrackerScoreRepository scores = mock(ScoreTrackerScoreRepository.class);
    private final ScoreDayRepository days = mock(ScoreDayRepository.class);
    private final ScoreDayPlayerRepository dayPlayers = mock(ScoreDayPlayerRepository.class);
    private final ScoreSessionPlayerRepository sessionPlayers = mock(ScoreSessionPlayerRepository.class);
    private final UserAccountRepository users = mock(UserAccountRepository.class);
    private final WebSocketService webSocket = mock(WebSocketService.class);
    private final UserAccount owner = user(1L, "Dueño");
    private final League league = League.builder().id(10L).name("Mus").joinCode("ABCDEFGH")
            .kind(League.KIND_SCOREBOARD).adminUser(owner).build();
    private final ScoreGame mus = ScoreGame.builder().id(50L).leagueId(10L).name("Mus").build();
    private final ScoreGame parchis = ScoreGame.builder().id(51L).leagueId(10L).name("Parchís").build();
    private final ScoreTrackerService service = new ScoreTrackerService(leagues, memberships, membershipService,
            leagueService, new ScoreboardRoster(players), games, players, sessions, rounds, scores, days, dayPlayers,
            sessionPlayers, users, webSocket);

    private static UserAccount user(Long id, String name) {
        UserAccount user = new UserAccount();
        user.setId(id);
        user.setParticipantName(name);
        return user;
    }

    @BeforeEach
    void setUp() {
        stubUser("dueno@x.com", owner);
        stubUser("miembro@x.com", user(2L, "Berto"));
        stubUser("ajeno@x.com", user(3L, "Carla"));
        when(leagues.findById(10L)).thenReturn(Optional.of(league));
        when(memberships.existsById(new Membership.MembershipId(1L, 10L))).thenReturn(true);
        when(memberships.existsById(new Membership.MembershipId(2L, 10L))).thenReturn(true);
        when(games.findByLeagueIdOrderByIdAsc(10L)).thenReturn(List.of(mus, parchis));
        when(games.findById(50L)).thenReturn(Optional.of(mus));
        when(games.findById(51L)).thenReturn(Optional.of(parchis));
        when(players.save(any())).thenAnswer(call -> {
            ScoreTrackerPlayer given = call.getArgument(0);
            if (given.getId() == null) given.setId(100L + given.getPosition());
            return given;
        });
        when(days.save(any())).thenAnswer(call -> {
            ScoreDay given = call.getArgument(0);
            if (given.getId() == null) given.setId(90L);
            return given;
        });
        when(sessions.save(any())).thenAnswer(call -> {
            ScoreTrackerSession given = call.getArgument(0);
            if (given.getId() == null) given.setId(71L);
            return given;
        });
        when(rounds.save(any())).thenAnswer(call -> {
            ScoreTrackerRound given = call.getArgument(0);
            if (given.getId() == null) given.setId(81L);
            return given;
        });
    }

    private void stubUser(String email, UserAccount user) {
        when(users.findByGoogleEmail(email)).thenReturn(Optional.of(user));
    }

    @Test
    void strangerCannotSeeAScoreboardAndGetsTheSameErrorAsAMissingOne() {
        assertThatThrownBy(() -> service.get("ajeno@x.com", 10L)).isInstanceOf(BusinessException.class)
                .hasMessage("Marcador no encontrado");
        assertThatThrownBy(() -> service.get("ajeno@x.com", 99L)).isInstanceOf(BusinessException.class)
                .hasMessage("Marcador no encontrado");
    }

    @Test
    void aPoolLeagueIsNotAScoreboard() {
        League pool = League.builder().id(11L).name("Porra").adminUser(owner).build();
        when(leagues.findById(11L)).thenReturn(Optional.of(pool));
        when(memberships.existsById(new Membership.MembershipId(1L, 11L))).thenReturn(true);

        assertThatThrownBy(() -> service.get("dueno@x.com", 11L)).isInstanceOf(BusinessException.class)
                .hasMessage("Marcador no encontrado");
    }

    @Test
    void aMemberWritesButOnlyTheAdminRenamesOrDeletes() {
        assertThatThrownBy(() -> service.renameGame("miembro@x.com", 10L, 50L, new ScoreGameNameRequest("X")))
                .isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> service.deleteGame("miembro@x.com", 10L, 51L)).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> service.delete("miembro@x.com", 10L)).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> service.addRound("ajeno@x.com", 10L, points(Map.of(100L, 1))))
                .isInstanceOf(BusinessException.class).hasMessage("Marcador no encontrado");
        verify(games, never()).delete(any());
        verify(leagues, never()).delete(any());

        service.addGame("miembro@x.com", 10L, new ScoreGameRequest("Tute", "puntos", false, null));
        verify(games).save(any());
    }

    @Test
    void joiningWithAnUnknownCodeFails() {
        when(leagues.findByJoinCode("NOEXISTE")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.join("ajeno@x.com", "noexiste")).isInstanceOf(BusinessException.class);
        verify(membershipService, never()).join(any(), any());
    }

    @Test
    void ownerCannotLeaveTheirOwnScoreboard() {
        assertThatThrownBy(() -> service.leave("dueno@x.com", 10L)).isInstanceOf(BusinessException.class);
        verify(membershipService, never()).leave(any(), any());
    }

    @Test
    void aMemberLeavesThroughTheLeagueMembership() {
        service.leave("miembro@x.com", 10L);

        verify(membershipService).leave(10L, "miembro@x.com");
    }

    @Test
    void aMemberClaimsAPlayerAndReleasesThePreviousOne() {
        ScoreTrackerPlayer ana = ScoreTrackerPlayer.builder().id(100L).leagueId(10L).name("Ana").build();
        ScoreTrackerPlayer berto = ScoreTrackerPlayer.builder().id(101L).leagueId(10L).name("Berto").build();
        ana.setUserId(2L);
        when(players.findById(101L)).thenReturn(Optional.of(berto));
        when(players.findByLeagueIdAndUserId(10L, 2L)).thenReturn(Optional.of(ana));

        ScoreTrackerDTO view = service.claimPlayer("miembro@x.com", 10L, 101L);

        assertThat(ana.getUserId()).isNull();
        assertThat(berto.getUserId()).isEqualTo(2L);
        assertThat(view).isNotNull();
        verify(webSocket).notifyTrackerChanged(eq(10L), any());
    }

    @Test
    void aPlayerAlreadyClaimedBySomeoneElseCannotBeTaken() {
        ScoreTrackerPlayer ana = ScoreTrackerPlayer.builder().id(100L).leagueId(10L).name("Ana").userId(1L).build();
        when(players.findById(100L)).thenReturn(Optional.of(ana));

        assertThatThrownBy(() -> service.claimPlayer("miembro@x.com", 10L, 100L)).isInstanceOf(BusinessException.class);
        assertThat(ana.getUserId()).isEqualTo(1L);
    }

    @Test
    void strangersAndPlayersOfAnotherLeagueCannotBeClaimed() {
        ScoreTrackerPlayer other = ScoreTrackerPlayer.builder().id(200L).leagueId(11L).name("Zoe").build();
        when(players.findById(200L)).thenReturn(Optional.of(other));

        assertThatThrownBy(() -> service.claimPlayer("ajeno@x.com", 10L, 100L)).isInstanceOf(BusinessException.class)
                .hasMessage("Marcador no encontrado");
        assertThatThrownBy(() -> service.claimPlayer("miembro@x.com", 10L, 200L)).isInstanceOf(BusinessException.class)
                .hasMessage("Jugador no válido");
        assertThat(other.getUserId()).isNull();
    }

    private ScoreTrackerPlayer savedPlayer() {
        ArgumentCaptor<ScoreTrackerPlayer> saved = ArgumentCaptor.forClass(ScoreTrackerPlayer.class);
        verify(players).save(saved.capture());
        return saved.getValue();
    }

    @Test
    void creatingAScoreboardMakesAScoreboardLeagueWithItsFirstGameAndTheCreatorAsPlayer() {
        when(leagues.findByAdminUserId(1L)).thenReturn(List.of());
        when(leagues.save(any())).thenAnswer(call -> {
            League given = call.getArgument(0);
            given.setId(11L);
            return given;
        });
        when(games.save(any())).thenAnswer(call -> {
            ScoreGame given = call.getArgument(0);
            given.setId(60L);
            return given;
        });

        service.create("dueno@x.com", new ScoreTrackerRequest("Noche de juegos", "Catán", "puntos", false, null, null));

        ArgumentCaptor<League> savedLeague = ArgumentCaptor.forClass(League.class);
        verify(leagues).save(savedLeague.capture());
        assertThat(savedLeague.getValue().isScoreboard()).isTrue();
        assertThat(savedLeague.getValue().getAdminUserId()).isEqualTo(1L);
        ArgumentCaptor<ScoreGame> savedGame = ArgumentCaptor.forClass(ScoreGame.class);
        verify(games).save(savedGame.capture());
        assertThat(savedGame.getValue().getName()).isEqualTo("Catán");
        ScoreTrackerPlayer first = savedPlayer();
        assertThat(first.getName()).isEqualTo("Dueño");
        assertThat(first.getUserId()).isEqualTo(1L);
        assertThat(first.getLeagueId()).isEqualTo(11L);
        ArgumentCaptor<ScoreTrackerSession> savedSession = ArgumentCaptor.forClass(ScoreTrackerSession.class);
        verify(sessions).save(savedSession.capture());
        assertThat(savedSession.getValue().getGameId()).isEqualTo(60L);
    }

    @Test
    void theFirstGameTakesTheLeagueNameWhenNoneIsGiven() {
        when(leagues.findByAdminUserId(1L)).thenReturn(List.of());
        when(leagues.save(any())).thenAnswer(call -> {
            League given = call.getArgument(0);
            given.setId(11L);
            return given;
        });
        when(games.save(any())).thenAnswer(call -> {
            ScoreGame given = call.getArgument(0);
            given.setId(60L);
            return given;
        });

        service.create("dueno@x.com", new ScoreTrackerRequest("Mus", null, null, false, null, null));

        ArgumentCaptor<ScoreGame> savedGame = ArgumentCaptor.forClass(ScoreGame.class);
        verify(games).save(savedGame.capture());
        assertThat(savedGame.getValue().getName()).isEqualTo("Mus");
        assertThat(savedGame.getValue().getUnit()).isEqualTo("puntos");
    }

    @Test
    void extraNamesCannotRepeatTheCreator() {
        when(leagues.findByAdminUserId(1L)).thenReturn(List.of());
        ScoreTrackerRequest request = new ScoreTrackerRequest("Mus", null, "puntos", false, List.of("dueño"), null);

        assertThatThrownBy(() -> service.create("dueno@x.com", request)).isInstanceOf(BusinessException.class);
        verify(leagues, never()).save(any());
    }

    @Test
    void joiningAddsTheUserAsAPlayerUnderTheirOwnName() {
        when(leagues.findByJoinCode("ABCDEFGH")).thenReturn(Optional.of(league));
        ScoreTrackerPlayer first = ScoreTrackerPlayer.builder().id(100L).leagueId(10L).name("Dueño").userId(1L).build();
        when(players.findByLeagueIdOrderByPositionAsc(10L)).thenReturn(List.of(first));

        service.join("ajeno@x.com", "abcdefgh");

        verify(membershipService).join(10L, "ajeno@x.com");
        ScoreTrackerPlayer joined = savedPlayer();
        assertThat(joined.getName()).isEqualTo("Carla");
        assertThat(joined.getUserId()).isEqualTo(3L);
        assertThat(joined.getPosition()).isEqualTo(1);
        verify(webSocket).notifyTrackerChanged(eq(10L), any());
    }

    @Test
    void joiningTakesThePlayerTheOwnerAlreadyWroteWithTheSameName() {
        when(leagues.findByJoinCode("ABCDEFGH")).thenReturn(Optional.of(league));
        ScoreTrackerPlayer written = ScoreTrackerPlayer.builder().id(101L).leagueId(10L).name("berto").build();
        when(players.findByLeagueIdOrderByPositionAsc(10L)).thenReturn(List.of(written));
        when(memberships.existsById(new Membership.MembershipId(2L, 10L))).thenReturn(false);

        service.join("miembro@x.com", "ABCDEFGH");

        assertThat(written.getUserId()).isEqualTo(2L);
        verify(players).save(written);
    }

    @Test
    void joiningAgainDoesNotDuplicateThePlayer() {
        when(leagues.findByJoinCode("ABCDEFGH")).thenReturn(Optional.of(league));
        ScoreTrackerPlayer mine = ScoreTrackerPlayer.builder().id(101L).leagueId(10L).name("Berto").userId(2L).build();
        when(players.findByLeagueIdAndUserId(10L, 2L)).thenReturn(Optional.of(mine));

        service.join("miembro@x.com", "ABCDEFGH");

        verify(players, never()).save(any());
        verify(membershipService, never()).join(any(), any());
        verify(webSocket, never()).notifyTrackerChanged(any(), any());
    }

    @Test
    void aNameAlreadyTakenByAnotherPlayerGetsANumber() {
        when(leagues.findByJoinCode("ABCDEFGH")).thenReturn(Optional.of(league));
        ScoreTrackerPlayer other = ScoreTrackerPlayer.builder().id(100L).leagueId(10L).name("Carla").userId(1L).build();
        when(players.findByLeagueIdOrderByPositionAsc(10L)).thenReturn(List.of(other));

        service.join("ajeno@x.com", "ABCDEFGH");

        assertThat(savedPlayer().getName()).isEqualTo("Carla (2)");
    }

    @Test
    void changingGameOnAFilledSessionOpensANewSessionOfThatGame() {
        ScoreDay today = openDay();
        ScoreTrackerSession last = ScoreTrackerSession.builder().id(70L).leagueId(10L).gameId(50L).dayId(90L).build();
        when(sessions.findFirstByLeagueIdOrderByIdDesc(10L)).thenReturn(Optional.of(last));
        when(sessions.findByLeagueIdOrderByIdAsc(10L)).thenReturn(List.of(last));
        when(rounds.findByLeagueIdOrderByIdAsc(10L))
                .thenReturn(List.of(ScoreTrackerRound.builder().id(80L).leagueId(10L).sessionId(70L).build()));
        when(dayPlayers.findByDayId(90L)).thenReturn(List.of(new ScoreDayPlayer(90L, 101L)));

        service.newSession("miembro@x.com", 10L, 51L, null, 10);

        ArgumentCaptor<ScoreTrackerSession> saved = ArgumentCaptor.forClass(ScoreTrackerSession.class);
        verify(sessions, times(2)).save(saved.capture());
        assertThat(last.getEndedAt()).isNotNull();
        ScoreTrackerSession started = saved.getAllValues().get(1);
        assertThat(started).isNotSameAs(last);
        assertThat(started.getGameId()).isEqualTo(51L);
        assertThat(started.getDayId()).isEqualTo(today.getId());
        assertThat(started.getPlannedRounds()).isEqualTo(10);
        verify(sessionPlayers).save(new ScoreSessionPlayer(71L, 101L));
        verify(webSocket).notifyTrackerChanged(eq(10L), any());
    }

    @Test
    void changingGameOnAnEmptySessionJustSwitchesItsGame() {
        openDay();
        ScoreTrackerSession last = ScoreTrackerSession.builder().id(70L).leagueId(10L).gameId(50L).dayId(90L).build();
        when(sessions.findFirstByLeagueIdOrderByIdDesc(10L)).thenReturn(Optional.of(last));
        when(rounds.findByLeagueIdOrderByIdAsc(10L)).thenReturn(List.of());

        service.newSession("dueno@x.com", 10L, 51L, null, null);

        assertThat(last.getGameId()).isEqualTo(51L);
        verify(sessions).save(last);
    }

    @Test
    void aSessionCannotUseAGameOfAnotherLeague() {
        ScoreGame foreign = ScoreGame.builder().id(99L).leagueId(11L).name("Ajeno").build();
        when(games.findById(99L)).thenReturn(Optional.of(foreign));

        assertThatThrownBy(() -> service.newSession("dueno@x.com", 10L, 99L, null, null)).isInstanceOf(BusinessException.class)
                .hasMessage("Juego no válido");
    }

    @Test
    void gamesCannotRepeatNameInTheSameLeague() {
        assertThatThrownBy(() -> service.addGame("dueno@x.com", 10L, new ScoreGameRequest("parchís", "puntos", false, null)))
                .isInstanceOf(BusinessException.class).hasMessage("Ya hay un juego con ese nombre");
        assertThatThrownBy(() -> service.renameGame("dueno@x.com", 10L, 50L, new ScoreGameNameRequest(" PARCHÍS ")))
                .isInstanceOf(BusinessException.class).hasMessage("Ya hay un juego con ese nombre");
        verify(games, never()).save(any());
    }

    @Test
    void anOwnerAddsAndRenamesGames() {
        service.addGame("dueno@x.com", 10L, new ScoreGameRequest("Tute", "bazas", true, null));
        service.renameGame("dueno@x.com", 10L, 50L, new ScoreGameNameRequest("Mus a 30"));

        ArgumentCaptor<ScoreGame> saved = ArgumentCaptor.forClass(ScoreGame.class);
        verify(games, times(2)).save(saved.capture());
        assertThat(saved.getAllValues().get(0).getName()).isEqualTo("Tute");
        assertThat(saved.getAllValues().get(0).isLowerWins()).isTrue();
        assertThat(mus.getName()).isEqualTo("Mus a 30");
    }

    @Test
    void aGameWithRoundsCannotBeDeleted() {
        when(games.countByLeagueId(10L)).thenReturn(2L);
        when(sessions.findByLeagueIdOrderByIdAsc(10L))
                .thenReturn(List.of(ScoreTrackerSession.builder().id(70L).leagueId(10L).gameId(51L).build()));
        when(rounds.findByLeagueIdOrderByIdAsc(10L))
                .thenReturn(List.of(ScoreTrackerRound.builder().id(80L).leagueId(10L).sessionId(70L).build()));

        assertThatThrownBy(() -> service.deleteGame("dueno@x.com", 10L, 51L)).isInstanceOf(BusinessException.class);
        verify(games, never()).delete(any());
    }

    @Test
    void theOnlyGameCannotBeDeletedButAnEmptyOneCan() {
        when(games.countByLeagueId(10L)).thenReturn(1L);
        assertThatThrownBy(() -> service.deleteGame("dueno@x.com", 10L, 51L)).isInstanceOf(BusinessException.class);

        when(games.countByLeagueId(10L)).thenReturn(2L);
        when(sessions.findByLeagueIdOrderByIdAsc(10L)).thenReturn(List.of());
        when(rounds.findByLeagueIdOrderByIdAsc(10L)).thenReturn(List.of());

        service.deleteGame("dueno@x.com", 10L, 51L);

        verify(games).delete(parchis);
    }

    // ---- Días, partidas y rondas ----

    private static ScoreTrackerRoundRequest points(Map<Long, Integer> given) {
        return new ScoreTrackerRoundRequest(null, given, null, null);
    }

    private ScoreDay openDay() {
        ScoreDay day = ScoreDay.builder().id(90L).leagueId(10L).build();
        when(days.findFirstByLeagueIdAndClosedAtIsNullOrderByIdDesc(10L)).thenReturn(Optional.of(day));
        return day;
    }

    private void threePlayers() {
        when(players.findByLeagueIdOrderByPositionAsc(10L)).thenReturn(List.of(
                ScoreTrackerPlayer.builder().id(100L).leagueId(10L).name("Ana").userId(1L).build(),
                ScoreTrackerPlayer.builder().id(101L).leagueId(10L).name("Berto").userId(2L).position(1).build(),
                ScoreTrackerPlayer.builder().id(102L).leagueId(10L).name("Carla").position(2).build()));
    }

    private ScoreTrackerSession openSession(Long gameId, Long... participants) {
        ScoreTrackerSession session = ScoreTrackerSession.builder().id(70L).leagueId(10L).gameId(gameId).dayId(90L)
                .build();
        when(sessions.findFirstByLeagueIdOrderByIdDesc(10L)).thenReturn(Optional.of(session));
        when(sessions.findById(70L)).thenReturn(Optional.of(session));
        when(sessionPlayers.findBySessionId(70L)).thenReturn(Arrays.stream(participants)
                .map(id -> new ScoreSessionPlayer(70L, id)).toList());
        return session;
    }

    private List<ScoreTrackerScore> savedScores() {
        ArgumentCaptor<ScoreTrackerScore> saved = ArgumentCaptor.forClass(ScoreTrackerScore.class);
        verify(scores, atLeast(0)).save(saved.capture());
        return saved.getAllValues();
    }

    @Test
    void aRoundOnlyKeepsThePointsOfWhoPlayedItAndWhoWroteIt() {
        threePlayers();
        openSession(50L, 100L, 101L, 102L);

        service.addRound("miembro@x.com", 10L, points(Map.of(100L, 5, 101L, 3)));

        assertThat(savedScores()).extracting(ScoreTrackerScore::getPlayerId).containsExactlyInAnyOrder(100L, 101L);
        ArgumentCaptor<ScoreTrackerRound> round = ArgumentCaptor.forClass(ScoreTrackerRound.class);
        verify(rounds).save(round.capture());
        assertThat(round.getValue().getCreatedByUserId()).isEqualTo(2L);
        assertThat(round.getValue().getSessionId()).isEqualTo(70L);
    }

    @Test
    void aRoundWithoutPointsOrWithAStrangerIsRefused() {
        threePlayers();
        openSession(50L, 100L, 101L);

        assertThatThrownBy(() -> service.addRound("dueno@x.com", 10L, points(Map.of())))
                .isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> service.addRound("dueno@x.com", 10L, points(Map.of(999L, 1))))
                .isInstanceOf(BusinessException.class).hasMessage("Jugador no válido");
        verify(rounds, never()).save(any());
    }

    @Test
    void whoScoresWithoutBeingInTheSessionJoinsIt() {
        threePlayers();
        openSession(50L, 100L, 101L);

        service.addRound("dueno@x.com", 10L, points(Map.of(100L, 5, 102L, 2)));

        verify(sessionPlayers).save(new ScoreSessionPlayer(70L, 102L));
        verify(sessionPlayers, never()).save(new ScoreSessionPlayer(70L, 100L));
    }

    @Test
    void inAGameByWinsTheWinnersGetOneAndTheOtherPlayersZero() {
        mus.setMode(ScoreGame.MODE_WINS);
        threePlayers();
        openSession(50L, 100L, 101L);

        service.addRound("miembro@x.com", 10L, new ScoreTrackerRoundRequest(null, null, null, List.of(101L)));

        assertThat(savedScores()).extracting(ScoreTrackerScore::getPlayerId, ScoreTrackerScore::getPoints)
                .containsExactlyInAnyOrder(Tuple.tuple(100L, 0), Tuple.tuple(101L, 1));
    }

    @Test
    void theOldPlusOneButtonStillMarksTheWinnerInAGameByWins() {
        mus.setMode(ScoreGame.MODE_WINS);
        threePlayers();
        openSession(50L, 100L, 101L);

        service.addRound("dueno@x.com", 10L, points(Map.of(100L, 1)));

        assertThat(savedScores()).extracting(ScoreTrackerScore::getPlayerId, ScoreTrackerScore::getPoints)
                .containsExactlyInAnyOrder(Tuple.tuple(100L, 1), Tuple.tuple(101L, 0));
    }

    @Test
    void aGameByWinsNeedsAWinner() {
        mus.setMode(ScoreGame.MODE_WINS);
        threePlayers();
        openSession(50L, 100L, 101L);

        assertThatThrownBy(() -> service.addRound("dueno@x.com", 10L, points(Map.of(100L, 0))))
                .isInstanceOf(BusinessException.class).hasMessage("Marca quién ha ganado la ronda");
    }

    @Test
    void aFinishedSessionCannotTakeRoundsUntilReopened() {
        threePlayers();
        ScoreTrackerSession session = openSession(50L, 100L, 101L);
        session.setEndedAt(Instant.now());
        ScoreTrackerRoundRequest request = new ScoreTrackerRoundRequest(null, Map.of(100L, 1), 70L, null);

        assertThatThrownBy(() -> service.addRound("miembro@x.com", 10L, request))
                .isInstanceOf(BusinessException.class);

        service.reopenSession("miembro@x.com", 10L, 70L);
        assertThat(session.isOpen()).isTrue();
        service.addRound("miembro@x.com", 10L, request);
        verify(rounds).save(any());
    }

    @Test
    void withoutChoosingASessionTheOldClientStartsAnotherOfTheSameGameWhenTheLastIsOver() {
        threePlayers();
        ScoreTrackerSession last = openSession(51L, 100L, 101L);
        last.setEndedAt(Instant.now());

        service.addRound("dueno@x.com", 10L, points(Map.of(100L, 4)));

        ArgumentCaptor<ScoreTrackerSession> saved = ArgumentCaptor.forClass(ScoreTrackerSession.class);
        verify(sessions).save(saved.capture());
        assertThat(saved.getValue().getId()).isEqualTo(71L);
        assertThat(saved.getValue().getGameId()).isEqualTo(51L);
        ArgumentCaptor<ScoreTrackerRound> round = ArgumentCaptor.forClass(ScoreTrackerRound.class);
        verify(rounds).save(round.capture());
        assertThat(round.getValue().getSessionId()).isEqualTo(71L);
    }

    @Test
    void endingASessionKeepsItsRoundsAndReopeningClearsTheEnd() {
        ScoreTrackerSession session = openSession(50L, 100L);

        service.endSession("miembro@x.com", 10L, 70L);
        assertThat(session.getEndedAt()).isNotNull();

        service.reopenSession("miembro@x.com", 10L, 70L);
        assertThat(session.getEndedAt()).isNull();
        verify(rounds, never()).delete(any());
    }

    @Test
    void editingARoundReplacesItsPoints() {
        threePlayers();
        openSession(50L, 100L, 101L, 102L);
        when(rounds.findById(80L))
                .thenReturn(Optional.of(ScoreTrackerRound.builder().id(80L).leagueId(10L).sessionId(70L).build()));
        ScoreTrackerScore ana = ScoreTrackerScore.builder().roundId(80L).playerId(100L).points(5).build();
        ScoreTrackerScore berto = ScoreTrackerScore.builder().roundId(80L).playerId(101L).points(3).build();
        when(scores.findByRoundIdIn(List.of(80L))).thenReturn(List.of(ana, berto));

        service.editRound("miembro@x.com", 10L, 80L,
                new ScoreTrackerRoundRequest("corregida", Map.of(100L, 7, 102L, 2), null, null));

        assertThat(ana.getPoints()).isEqualTo(7);
        verify(scores).delete(berto);
        assertThat(savedScores()).extracting(ScoreTrackerScore::getPlayerId).containsExactlyInAnyOrder(100L, 102L);
    }

    @Test
    void onlyTheAdminCorrectsAFinishedSession() {
        threePlayers();
        ScoreTrackerSession session = openSession(50L, 100L, 101L);
        session.setEndedAt(Instant.now());
        when(rounds.findById(80L))
                .thenReturn(Optional.of(ScoreTrackerRound.builder().id(80L).leagueId(10L).sessionId(70L).build()));

        assertThatThrownBy(() -> service.deleteRound("miembro@x.com", 10L, 80L)).isInstanceOf(BusinessException.class);
        verify(rounds, never()).delete(any());

        service.deleteRound("dueno@x.com", 10L, 80L);
        verify(rounds).delete(any());
    }

    @Test
    void aPlayerWithPointsCannotBeTakenOutOfTheSession() {
        threePlayers();
        openSession(50L, 100L, 101L);
        when(rounds.findByLeagueIdOrderByIdAsc(10L))
                .thenReturn(List.of(ScoreTrackerRound.builder().id(80L).leagueId(10L).sessionId(70L).build()));
        when(scores.findByRoundIdIn(List.of(80L)))
                .thenReturn(List.of(ScoreTrackerScore.builder().roundId(80L).playerId(101L).points(3).build()));

        assertThatThrownBy(() -> service.setSessionPlayers("dueno@x.com", 10L, 70L, List.of(100L)))
                .isInstanceOf(BusinessException.class);
        verify(sessionPlayers, never()).delete(any());

        service.setSessionPlayers("dueno@x.com", 10L, 70L, List.of(101L, 102L));
        verify(sessionPlayers).delete(new ScoreSessionPlayer(70L, 100L));
        verify(sessionPlayers).save(new ScoreSessionPlayer(70L, 102L));
    }

    @Test
    void startingADayMarksWhoCame() {
        threePlayers();

        service.startDay("miembro@x.com", 10L, List.of(100L, 102L));

        verify(days).save(any());
        verify(dayPlayers).save(new ScoreDayPlayer(90L, 100L));
        verify(dayPlayers).save(new ScoreDayPlayer(90L, 102L));
        verify(dayPlayers, never()).save(new ScoreDayPlayer(90L, 101L));
    }

    @Test
    void aDayForgottenOpenIsClosedAndItsEmptySessionsDropped() {
        threePlayers();
        Instant old = Instant.now().minus(ScoreTrackerService.STALE_DAY).minus(Duration.ofHours(1));
        ScoreDay stale = ScoreDay.builder().id(89L).leagueId(10L).startedAt(old).build();
        when(days.findFirstByLeagueIdAndClosedAtIsNullOrderByIdDesc(10L)).thenReturn(Optional.of(stale));
        ScoreTrackerSession played = ScoreTrackerSession.builder().id(70L).leagueId(10L).gameId(50L).dayId(89L)
                .startedAt(old).build();
        ScoreTrackerSession empty = ScoreTrackerSession.builder().id(72L).leagueId(10L).gameId(50L).dayId(89L)
                .startedAt(old).build();
        when(sessions.findByLeagueIdOrderByIdAsc(10L)).thenReturn(List.of(played, empty));
        when(rounds.findByLeagueIdOrderByIdAsc(10L)).thenReturn(List.of(
                ScoreTrackerRound.builder().id(80L).leagueId(10L).sessionId(70L).createdAt(old).build()));

        service.startDay("dueno@x.com", 10L, null);

        assertThat(stale.getClosedAt()).isEqualTo(old);
        assertThat(played.getEndedAt()).isEqualTo(old);
        verify(sessions).delete(empty);
        ArgumentCaptor<ScoreDay> saved = ArgumentCaptor.forClass(ScoreDay.class);
        verify(days, times(2)).save(saved.capture());
        assertThat(saved.getAllValues().get(1)).isNotSameAs(stale);
    }

    @Test
    void closingADayWithoutRoundsLeavesNoTrace() {
        ScoreDay today = openDay();
        when(days.findById(90L)).thenReturn(Optional.of(today));
        ScoreTrackerSession empty = ScoreTrackerSession.builder().id(70L).leagueId(10L).gameId(50L).dayId(90L).build();
        when(sessions.findByLeagueIdOrderByIdAsc(10L)).thenReturn(List.of(empty));

        service.closeDay("miembro@x.com", 10L, 90L);

        verify(sessions).delete(empty);
        verify(days).delete(today);
    }

    @Test
    void theViewRanksOnlyWhoPlayedAndCountsWinsOfFinishedSessions() {
        parchis.setLowerWins(true);
        threePlayers();
        ScoreTrackerSession finished = ScoreTrackerSession.builder().id(70L).leagueId(10L).gameId(51L).dayId(90L)
                .endedAt(Instant.now()).build();
        ScoreTrackerSession open = ScoreTrackerSession.builder().id(71L).leagueId(10L).gameId(51L).dayId(90L).build();
        when(sessions.findByLeagueIdOrderByIdAsc(10L)).thenReturn(List.of(finished, open));
        when(rounds.findByLeagueIdOrderByIdAsc(10L)).thenReturn(List.of(
                ScoreTrackerRound.builder().id(80L).leagueId(10L).sessionId(70L).createdByUserId(2L).build(),
                ScoreTrackerRound.builder().id(81L).leagueId(10L).sessionId(71L).build()));
        when(scores.findByRoundIdIn(List.of(80L, 81L))).thenReturn(List.of(
                ScoreTrackerScore.builder().roundId(80L).playerId(100L).points(12).build(),
                ScoreTrackerScore.builder().roundId(80L).playerId(101L).points(7).build(),
                ScoreTrackerScore.builder().roundId(81L).playerId(100L).points(1).build()));
        when(sessionPlayers.findBySessionIdIn(List.of(70L, 71L))).thenReturn(List.of(
                new ScoreSessionPlayer(70L, 100L), new ScoreSessionPlayer(70L, 101L),
                new ScoreSessionPlayer(71L, 100L), new ScoreSessionPlayer(71L, 102L)));
        when(days.findByLeagueIdOrderByIdAsc(10L)).thenReturn(List.of(ScoreDay.builder().id(90L).leagueId(10L).build()));

        ScoreTrackerDTO view = service.get("dueno@x.com", 10L);

        ScoreTrackerDTO.Session first = view.sessions().get(0);
        assertThat(first.playerIds()).containsExactly(100L, 101L);
        assertThat(first.winners()).containsExactly(101L);
        assertThat(first.endedAt()).isNotNull();
        assertThat(view.sessions().get(1).winners()).containsExactly(100L);
        assertThat(view.overall().get(0).playerId()).isEqualTo(101L);
        assertThat(view.overall().get(0).sessionsWon()).isEqualTo(1);
        assertThat(view.overall()).filteredOn(standing -> standing.playerId() == 100L)
                .extracting(Standing::sessionsWon, Standing::sessionsPlayed)
                .containsExactly(Tuple.tuple(0, 1));
        assertThat(view.rounds().get(0).recordedBy()).isEqualTo("Berto");
        assertThat(view.currentDayId()).isEqualTo(90L);
        assertThat(view.days().get(0).sessionIds()).containsExactly(70L, 71L);
    }

    @Test
    void claimingDropsThePlayerCreatedOnJoinIfItNeverPlayed() {
        ScoreTrackerPlayer joined = ScoreTrackerPlayer.builder().id(100L).leagueId(10L).name("Berto").userId(2L).build();
        ScoreTrackerPlayer guest = ScoreTrackerPlayer.builder().id(101L).leagueId(10L).name("Bertito").build();
        when(players.findById(101L)).thenReturn(Optional.of(guest));
        when(players.findByLeagueIdAndUserId(10L, 2L)).thenReturn(Optional.of(joined));

        service.claimPlayer("miembro@x.com", 10L, 101L);

        verify(players).delete(joined);
        assertThat(guest.getUserId()).isEqualTo(2L);
    }

    @Test
    void claimingKeepsThePreviousPlayerIfItHasPlayed() {
        ScoreTrackerPlayer joined = ScoreTrackerPlayer.builder().id(100L).leagueId(10L).name("Berto").userId(2L).build();
        ScoreTrackerPlayer guest = ScoreTrackerPlayer.builder().id(101L).leagueId(10L).name("Bertito").build();
        when(players.findById(101L)).thenReturn(Optional.of(guest));
        when(players.findByLeagueIdAndUserId(10L, 2L)).thenReturn(Optional.of(joined));
        when(sessionPlayers.findByPlayerId(100L)).thenReturn(List.of(new ScoreSessionPlayer(70L, 100L)));

        service.claimPlayer("miembro@x.com", 10L, 101L);

        verify(players, never()).delete(any(ScoreTrackerPlayer.class));
        assertThat(joined.getUserId()).isNull();
    }

    @Test
    void theAdminOrThePlayerThemselfRenamesAPlayerWithAFreeName() {
        ScoreTrackerPlayer ana = ScoreTrackerPlayer.builder().id(100L).leagueId(10L).name("Ana").build();
        ScoreTrackerPlayer berto = ScoreTrackerPlayer.builder().id(101L).leagueId(10L).name("Berto").userId(2L).build();
        when(players.findById(100L)).thenReturn(Optional.of(ana));
        when(players.findById(101L)).thenReturn(Optional.of(berto));
        when(players.findByLeagueIdOrderByPositionAsc(10L)).thenReturn(List.of(ana, berto));

        assertThatThrownBy(() -> service.renamePlayer("miembro@x.com", 10L, 100L, "Anita"))
                .isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> service.renamePlayer("dueno@x.com", 10L, 100L, "berto"))
                .isInstanceOf(BusinessException.class).hasMessage("Ya hay un jugador con ese nombre");

        service.renamePlayer("dueno@x.com", 10L, 100L, "  Anita ");
        service.renamePlayer("miembro@x.com", 10L, 101L, "Bertín");

        assertThat(ana.getName()).isEqualTo("Anita");
        assertThat(berto.getName()).isEqualTo("Bertín");
    }

    @Test
    void onlyAnUnclaimedPlayerWhoNeverPlayedCanBeDeleted() {
        ScoreTrackerPlayer ana = ScoreTrackerPlayer.builder().id(100L).leagueId(10L).name("Ana").build();
        ScoreTrackerPlayer berto = ScoreTrackerPlayer.builder().id(101L).leagueId(10L).name("Berto").userId(2L).build();
        ScoreTrackerPlayer carla = ScoreTrackerPlayer.builder().id(102L).leagueId(10L).name("Carla").build();
        when(players.findById(100L)).thenReturn(Optional.of(ana));
        when(players.findById(101L)).thenReturn(Optional.of(berto));
        when(players.findById(102L)).thenReturn(Optional.of(carla));
        when(scores.findByPlayerIdIn(List.of(102L)))
                .thenReturn(List.of(ScoreTrackerScore.builder().roundId(80L).playerId(102L).points(3).build()));

        assertThatThrownBy(() -> service.deletePlayer("miembro@x.com", 10L, 100L)).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> service.deletePlayer("dueno@x.com", 10L, 101L)).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> service.deletePlayer("dueno@x.com", 10L, 102L)).isInstanceOf(BusinessException.class);

        service.deletePlayer("dueno@x.com", 10L, 100L);

        verify(players).delete(ana);
        verify(players, never()).delete(carla);
    }

    @Test
    void mergingMovesScoresSessionsDaysAndTheAccountToTheRemainingPlayer() {
        ScoreTrackerPlayer dup = ScoreTrackerPlayer.builder().id(100L).leagueId(10L).name("Berto").userId(2L).build();
        ScoreTrackerPlayer guest = ScoreTrackerPlayer.builder().id(101L).leagueId(10L).name("Bertito").build();
        when(players.findById(100L)).thenReturn(Optional.of(dup));
        when(players.findById(101L)).thenReturn(Optional.of(guest));
        when(scores.findByPlayerIdIn(List.of(100L)))
                .thenReturn(List.of(ScoreTrackerScore.builder().roundId(80L).playerId(100L).points(5).build()));
        when(scores.findByPlayerIdIn(List.of(101L)))
                .thenReturn(List.of(ScoreTrackerScore.builder().roundId(81L).playerId(101L).points(2).build()));
        when(sessionPlayers.findByPlayerId(100L))
                .thenReturn(List.of(new ScoreSessionPlayer(70L, 100L), new ScoreSessionPlayer(71L, 100L)));
        when(sessionPlayers.findByPlayerId(101L)).thenReturn(List.of(new ScoreSessionPlayer(71L, 101L)));
        when(dayPlayers.findByPlayerId(100L)).thenReturn(List.of(new ScoreDayPlayer(90L, 100L)));

        assertThatThrownBy(() -> service.mergePlayer("miembro@x.com", 10L, 100L, 101L))
                .isInstanceOf(BusinessException.class);
        service.mergePlayer("dueno@x.com", 10L, 100L, 101L);

        ArgumentCaptor<ScoreTrackerScore> moved = ArgumentCaptor.forClass(ScoreTrackerScore.class);
        verify(scores).save(moved.capture());
        assertThat(moved.getValue().getPlayerId()).isEqualTo(101L);
        assertThat(moved.getValue().getRoundId()).isEqualTo(80L);
        assertThat(moved.getValue().getPoints()).isEqualTo(5);
        verify(sessionPlayers).save(new ScoreSessionPlayer(70L, 101L));
        verify(sessionPlayers, never()).save(new ScoreSessionPlayer(71L, 101L));
        verify(dayPlayers).save(new ScoreDayPlayer(90L, 101L));
        verify(players).delete(dup);
        assertThat(guest.getUserId()).isEqualTo(2L);
    }

    @Test
    void playersWhoShareARoundOrBothHaveAnAccountCannotBeMerged() {
        ScoreTrackerPlayer ana = ScoreTrackerPlayer.builder().id(100L).leagueId(10L).name("Ana").build();
        ScoreTrackerPlayer berto = ScoreTrackerPlayer.builder().id(101L).leagueId(10L).name("Berto").build();
        when(players.findById(100L)).thenReturn(Optional.of(ana));
        when(players.findById(101L)).thenReturn(Optional.of(berto));
        when(scores.findByPlayerIdIn(any()))
                .thenReturn(List.of(ScoreTrackerScore.builder().roundId(80L).playerId(100L).points(1).build()));

        assertThatThrownBy(() -> service.mergePlayer("dueno@x.com", 10L, 100L, 100L))
                .isInstanceOf(BusinessException.class).hasMessage("Elige otro jugador");
        assertThatThrownBy(() -> service.mergePlayer("dueno@x.com", 10L, 100L, 101L))
                .isInstanceOf(BusinessException.class);
        ana.setUserId(1L);
        berto.setUserId(2L);
        assertThatThrownBy(() -> service.mergePlayer("dueno@x.com", 10L, 100L, 101L))
                .isInstanceOf(BusinessException.class).hasMessage("Los dos jugadores son de personas distintas");
        verify(players, never()).delete(any(ScoreTrackerPlayer.class));
    }

    @Test
    void theAdminDeletesADayCreatedByMistake() {
        ScoreDay day = ScoreDay.builder().id(90L).leagueId(10L).build();
        when(days.findById(90L)).thenReturn(Optional.of(day));

        assertThatThrownBy(() -> service.deleteDay("miembro@x.com", 10L, 90L)).isInstanceOf(BusinessException.class);
        service.deleteDay("dueno@x.com", 10L, 90L);

        verify(days).delete(day);
    }

    @Test
    void aClosedDayMovesToItsRealDateWithItsSessions() {
        java.time.ZoneId zone = java.time.ZoneId.systemDefault();
        Instant start = java.time.LocalDate.now(zone).atTime(20, 0).atZone(zone).toInstant();
        ScoreDay day = ScoreDay.builder().id(90L).leagueId(10L).startedAt(start).closedAt(start.plusSeconds(3600)).build();
        ScoreTrackerSession session = ScoreTrackerSession.builder().id(70L).leagueId(10L).gameId(50L).dayId(90L)
                .startedAt(start.plusSeconds(60)).endedAt(start.plusSeconds(1800)).build();
        ScoreTrackerSession other = ScoreTrackerSession.builder().id(71L).leagueId(10L).gameId(50L).dayId(91L)
                .startedAt(start).build();
        when(days.findById(90L)).thenReturn(Optional.of(day));
        when(sessions.findByLeagueIdOrderByIdAsc(10L)).thenReturn(List.of(session, other));
        java.time.LocalDate past = java.time.LocalDate.now(zone).minusDays(3);

        assertThatThrownBy(() -> service.moveDay("dueno@x.com", 10L, 90L, java.time.LocalDate.now(zone).plusDays(1)))
                .isInstanceOf(BusinessException.class);
        service.moveDay("dueno@x.com", 10L, 90L, past);

        assertThat(day.getStartedAt().atZone(zone).toLocalDate()).isEqualTo(past);
        assertThat(day.getStartedAt().atZone(zone).getHour()).isEqualTo(20);
        assertThat(session.getStartedAt().atZone(zone).toLocalDate()).isEqualTo(past);
        assertThat(session.getEndedAt().atZone(zone).toLocalDate()).isEqualTo(past);
        assertThat(other.getStartedAt()).isEqualTo(start);
    }

    @Test
    void anOpenDayCannotChangeItsDate() {
        ScoreDay day = ScoreDay.builder().id(90L).leagueId(10L).build();
        when(days.findById(90L)).thenReturn(Optional.of(day));

        assertThatThrownBy(() -> service.moveDay("dueno@x.com", 10L, 90L, java.time.LocalDate.now().minusDays(1)))
                .isInstanceOf(BusinessException.class).hasMessage("Cierra el día antes de cambiarle la fecha");
    }

    @Test
    void editingAGameAlsoChangesItsUnit() {
        service.renameGame("dueno@x.com", 10L, 51L, new app.porrapp.dto.ScoreGameNameRequest("Parchís", "fichas"));

        assertThat(parchis.getUnit()).isEqualTo("fichas");
    }
}
