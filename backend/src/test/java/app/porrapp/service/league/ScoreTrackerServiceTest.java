package app.porrapp.service.league;

import app.porrapp.dto.ScoreGameNameRequest;
import app.porrapp.dto.ScoreGameRequest;
import app.porrapp.dto.ScoreTrackerDTO;
import app.porrapp.dto.ScoreTrackerRequest;
import app.porrapp.dto.ScoreTrackerRoundRequest;
import app.porrapp.exception.BusinessException;
import app.porrapp.model.League;
import app.porrapp.model.Membership;
import app.porrapp.model.ScoreGame;
import app.porrapp.model.ScoreTrackerPlayer;
import app.porrapp.model.ScoreTrackerRound;
import app.porrapp.model.ScoreTrackerSession;
import app.porrapp.model.UserAccount;
import app.porrapp.repository.LeagueRepository;
import app.porrapp.repository.MembershipRepository;
import app.porrapp.repository.ScoreGameRepository;
import app.porrapp.repository.ScoreTrackerPlayerRepository;
import app.porrapp.repository.ScoreTrackerRoundRepository;
import app.porrapp.repository.ScoreTrackerScoreRepository;
import app.porrapp.repository.ScoreTrackerSessionRepository;
import app.porrapp.repository.UserAccountRepository;
import app.porrapp.service.notification.WebSocketService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
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
    private final UserAccountRepository users = mock(UserAccountRepository.class);
    private final WebSocketService webSocket = mock(WebSocketService.class);
    private final UserAccount owner = user(1L, "Dueño");
    private final League league = League.builder().id(10L).name("Mus").joinCode("ABCDEFGH")
            .kind(League.KIND_SCOREBOARD).adminUser(owner).build();
    private final ScoreGame mus = ScoreGame.builder().id(50L).leagueId(10L).name("Mus").build();
    private final ScoreGame parchis = ScoreGame.builder().id(51L).leagueId(10L).name("Parchís").build();
    private final ScoreTrackerService service = new ScoreTrackerService(leagues, memberships, membershipService,
            leagueService, new ScoreboardRoster(players), games, players, sessions, rounds, scores, users, webSocket);

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
    void aMemberWatchesButCannotWrite() {
        ScoreTrackerRoundRequest round = new ScoreTrackerRoundRequest("x", Map.of());
        ScoreGameRequest game = new ScoreGameRequest("Tute", "puntos", false);

        assertThatThrownBy(() -> service.addRound("miembro@x.com", 10L, round)).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> service.newSession("miembro@x.com", 10L, null)).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> service.addGame("miembro@x.com", 10L, game)).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> service.renameGame("miembro@x.com", 10L, 50L, new ScoreGameNameRequest("X")))
                .isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> service.deleteGame("miembro@x.com", 10L, 51L)).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> service.addPlayer("miembro@x.com", 10L, "Pepe")).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> service.delete("miembro@x.com", 10L)).isInstanceOf(BusinessException.class);
        verify(rounds, never()).save(any());
        verify(games, never()).save(any());
        verify(webSocket, never()).notifyTrackerChanged(any(), any());
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

        service.create("dueno@x.com", new ScoreTrackerRequest("Noche de juegos", "Catán", "puntos", false, null));

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

        service.create("dueno@x.com", new ScoreTrackerRequest("Mus", null, null, false, null));

        ArgumentCaptor<ScoreGame> savedGame = ArgumentCaptor.forClass(ScoreGame.class);
        verify(games).save(savedGame.capture());
        assertThat(savedGame.getValue().getName()).isEqualTo("Mus");
        assertThat(savedGame.getValue().getUnit()).isEqualTo("puntos");
    }

    @Test
    void extraNamesCannotRepeatTheCreator() {
        when(leagues.findByAdminUserId(1L)).thenReturn(List.of());
        ScoreTrackerRequest request = new ScoreTrackerRequest("Mus", null, "puntos", false, List.of("dueño"));

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
        ScoreTrackerSession last = ScoreTrackerSession.builder().id(70L).leagueId(10L).gameId(50L).build();
        when(sessions.findFirstByLeagueIdOrderByIdDesc(10L)).thenReturn(Optional.of(last));
        when(rounds.findByLeagueIdOrderByIdAsc(10L))
                .thenReturn(List.of(ScoreTrackerRound.builder().id(80L).leagueId(10L).sessionId(70L).build()));

        service.newSession("dueno@x.com", 10L, 51L);

        ArgumentCaptor<ScoreTrackerSession> saved = ArgumentCaptor.forClass(ScoreTrackerSession.class);
        verify(sessions).save(saved.capture());
        assertThat(saved.getValue().getGameId()).isEqualTo(51L);
        assertThat(saved.getValue()).isNotSameAs(last);
        verify(webSocket).notifyTrackerChanged(eq(10L), any());
    }

    @Test
    void changingGameOnAnEmptySessionJustSwitchesItsGame() {
        ScoreTrackerSession last = ScoreTrackerSession.builder().id(70L).leagueId(10L).gameId(50L).build();
        when(sessions.findFirstByLeagueIdOrderByIdDesc(10L)).thenReturn(Optional.of(last));
        when(rounds.findByLeagueIdOrderByIdAsc(10L)).thenReturn(List.of());

        service.newSession("dueno@x.com", 10L, 51L);

        assertThat(last.getGameId()).isEqualTo(51L);
        verify(sessions).save(last);
    }

    @Test
    void aSessionCannotUseAGameOfAnotherLeague() {
        ScoreGame foreign = ScoreGame.builder().id(99L).leagueId(11L).name("Ajeno").build();
        when(games.findById(99L)).thenReturn(Optional.of(foreign));

        assertThatThrownBy(() -> service.newSession("dueno@x.com", 10L, 99L)).isInstanceOf(BusinessException.class)
                .hasMessage("Juego no válido");
    }

    @Test
    void gamesCannotRepeatNameInTheSameLeague() {
        assertThatThrownBy(() -> service.addGame("dueno@x.com", 10L, new ScoreGameRequest("parchís", "puntos", false)))
                .isInstanceOf(BusinessException.class).hasMessage("Ya hay un juego con ese nombre");
        assertThatThrownBy(() -> service.renameGame("dueno@x.com", 10L, 50L, new ScoreGameNameRequest(" PARCHÍS ")))
                .isInstanceOf(BusinessException.class).hasMessage("Ya hay un juego con ese nombre");
        verify(games, never()).save(any());
    }

    @Test
    void anOwnerAddsAndRenamesGames() {
        service.addGame("dueno@x.com", 10L, new ScoreGameRequest("Tute", "bazas", true));
        service.renameGame("dueno@x.com", 10L, 50L, new ScoreGameNameRequest("Mus a 30"));

        ArgumentCaptor<ScoreGame> saved = ArgumentCaptor.forClass(ScoreGame.class);
        verify(games, org.mockito.Mockito.times(2)).save(saved.capture());
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
}
