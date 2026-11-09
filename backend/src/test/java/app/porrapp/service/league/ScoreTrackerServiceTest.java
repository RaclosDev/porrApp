package app.porrapp.service.league;

import app.porrapp.dto.ScoreTrackerDTO;
import app.porrapp.dto.ScoreTrackerRequest;
import app.porrapp.dto.ScoreTrackerRoundRequest;
import app.porrapp.exception.BusinessException;
import app.porrapp.model.ScoreTracker;
import app.porrapp.model.ScoreTrackerMember;
import app.porrapp.model.ScoreTrackerPlayer;
import app.porrapp.model.UserAccount;
import app.porrapp.repository.ScoreTrackerMemberRepository;
import app.porrapp.repository.ScoreTrackerPlayerRepository;
import app.porrapp.repository.ScoreTrackerRepository;
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

    private final ScoreTrackerRepository trackers = mock(ScoreTrackerRepository.class);
    private final ScoreTrackerMemberRepository members = mock(ScoreTrackerMemberRepository.class);
    private final ScoreTrackerPlayerRepository players = mock(ScoreTrackerPlayerRepository.class);
    private final ScoreTrackerSessionRepository sessions = mock(ScoreTrackerSessionRepository.class);
    private final ScoreTrackerRoundRepository rounds = mock(ScoreTrackerRoundRepository.class);
    private final ScoreTrackerScoreRepository scores = mock(ScoreTrackerScoreRepository.class);
    private final UserAccountRepository users = mock(UserAccountRepository.class);
    private final WebSocketService webSocket = mock(WebSocketService.class);
    private final ScoreTracker tracker =
            ScoreTracker.builder().id(10L).ownerUserId(1L).name("Mus").joinCode("ABCDEFGH").build();
    private final ScoreTrackerService service =
            new ScoreTrackerService(trackers, members, players, sessions, rounds, scores, users, webSocket);

    @BeforeEach
    void setUp() {
        stubUser("dueno@x.com", 1L);
        stubUser("miembro@x.com", 2L);
        stubUser("ajeno@x.com", 3L);
        when(trackers.findById(10L)).thenReturn(Optional.of(tracker));
        when(members.existsById(new ScoreTrackerMember.Key(10L, 2L))).thenReturn(true);
    }

    private void stubUser(String email, Long id) {
        UserAccount user = new UserAccount();
        user.setId(id);
        user.setParticipantName(switch (email) {
            case "dueno@x.com" -> "Dueño";
            case "miembro@x.com" -> "Berto";
            default -> "Carla";
        });
        when(users.findByGoogleEmail(email)).thenReturn(Optional.of(user));
    }

    @Test
    void strangerCannotSeeATrackerAndGetsTheSameErrorAsAMissingOne() {
        assertThatThrownBy(() -> service.get("ajeno@x.com", 10L)).isInstanceOf(BusinessException.class)
                .hasMessage("Marcador no encontrado");
        assertThatThrownBy(() -> service.get("ajeno@x.com", 99L)).isInstanceOf(BusinessException.class)
                .hasMessage("Marcador no encontrado");
    }

    @Test
    void aMemberWatchesButCannotWrite() {
        ScoreTrackerRoundRequest round = new ScoreTrackerRoundRequest("x", Map.of());

        assertThatThrownBy(() -> service.addRound("miembro@x.com", 10L, round)).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> service.newSession("miembro@x.com", 10L)).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> service.addPlayer("miembro@x.com", 10L, "Pepe")).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> service.delete("miembro@x.com", 10L)).isInstanceOf(BusinessException.class);
        verify(rounds, never()).save(any());
        verify(webSocket, never()).notifyTrackerChanged(any(), any());
    }

    @Test
    void joiningWithAnUnknownCodeFails() {
        when(trackers.findByJoinCode("NOEXISTE")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.join("ajeno@x.com", "noexiste")).isInstanceOf(BusinessException.class);
        verify(members, never()).save(any());
    }

    @Test
    void ownerCannotLeaveTheirOwnTracker() {
        assertThatThrownBy(() -> service.leave("dueno@x.com", 10L)).isInstanceOf(BusinessException.class);
    }

    @Test
    void aMemberClaimsAPlayerAndReleasesThePreviousOne() {
        ScoreTrackerPlayer ana = ScoreTrackerPlayer.builder().id(100L).trackerId(10L).name("Ana").build();
        ScoreTrackerPlayer berto = ScoreTrackerPlayer.builder().id(101L).trackerId(10L).name("Berto").build();
        ana.setUserId(2L);
        when(players.findById(101L)).thenReturn(Optional.of(berto));
        when(players.findByTrackerIdAndUserId(10L, 2L)).thenReturn(Optional.of(ana));

        ScoreTrackerDTO view = service.claimPlayer("miembro@x.com", 10L, 101L);

        assertThat(ana.getUserId()).isNull();
        assertThat(berto.getUserId()).isEqualTo(2L);
        assertThat(view).isNotNull();
        verify(webSocket).notifyTrackerChanged(eq(10L), any());
    }

    @Test
    void aPlayerAlreadyClaimedBySomeoneElseCannotBeTaken() {
        ScoreTrackerPlayer ana = ScoreTrackerPlayer.builder().id(100L).trackerId(10L).name("Ana").userId(1L).build();
        when(players.findById(100L)).thenReturn(Optional.of(ana));

        assertThatThrownBy(() -> service.claimPlayer("miembro@x.com", 10L, 100L)).isInstanceOf(BusinessException.class);
        assertThat(ana.getUserId()).isEqualTo(1L);
    }

    @Test
    void strangersAndPlayersOfAnotherTrackerCannotBeClaimed() {
        ScoreTrackerPlayer other = ScoreTrackerPlayer.builder().id(200L).trackerId(11L).name("Zoe").build();
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
    void creatingATrackerNeedsNoPlayersAndTheCreatorIsTheFirstOne() {
        when(trackers.save(any())).thenAnswer(call -> {
            ScoreTracker given = call.getArgument(0);
            return ScoreTracker.builder().id(11L).ownerUserId(given.getOwnerUserId()).name(given.getName())
                    .unit(given.getUnit()).joinCode(given.getJoinCode()).build();
        });

        service.create("dueno@x.com", new ScoreTrackerRequest("Mus", "puntos", false, null));

        ScoreTrackerPlayer first = savedPlayer();
        assertThat(first.getName()).isEqualTo("Dueño");
        assertThat(first.getUserId()).isEqualTo(1L);
        assertThat(first.getTrackerId()).isEqualTo(11L);
    }

    @Test
    void extraNamesCannotRepeatTheCreator() {
        ScoreTrackerRequest request = new ScoreTrackerRequest("Mus", "puntos", false, List.of("dueño"));

        assertThatThrownBy(() -> service.create("dueno@x.com", request)).isInstanceOf(BusinessException.class);
        verify(trackers, never()).save(any());
    }

    @Test
    void joiningAddsTheUserAsAPlayerUnderTheirOwnName() {
        when(trackers.findByJoinCode("ABCDEFGH")).thenReturn(Optional.of(tracker));
        ScoreTrackerPlayer owner = ScoreTrackerPlayer.builder().id(100L).trackerId(10L).name("Dueño").userId(1L).build();
        when(players.findByTrackerIdOrderByPositionAsc(10L)).thenReturn(List.of(owner));

        service.join("ajeno@x.com", "abcdefgh");

        ScoreTrackerPlayer joined = savedPlayer();
        assertThat(joined.getName()).isEqualTo("Carla");
        assertThat(joined.getUserId()).isEqualTo(3L);
        assertThat(joined.getPosition()).isEqualTo(1);
        verify(webSocket).notifyTrackerChanged(eq(10L), any());
    }

    @Test
    void joiningTakesThePlayerTheOwnerAlreadyWroteWithTheSameName() {
        when(trackers.findByJoinCode("ABCDEFGH")).thenReturn(Optional.of(tracker));
        ScoreTrackerPlayer written = ScoreTrackerPlayer.builder().id(101L).trackerId(10L).name("berto").build();
        when(players.findByTrackerIdOrderByPositionAsc(10L)).thenReturn(List.of(written));

        service.join("miembro@x.com", "ABCDEFGH");

        assertThat(written.getUserId()).isEqualTo(2L);
        verify(players).save(written);
    }

    @Test
    void joiningAgainDoesNotDuplicateThePlayer() {
        when(trackers.findByJoinCode("ABCDEFGH")).thenReturn(Optional.of(tracker));
        ScoreTrackerPlayer mine = ScoreTrackerPlayer.builder().id(101L).trackerId(10L).name("Berto").userId(2L).build();
        when(players.findByTrackerIdAndUserId(10L, 2L)).thenReturn(Optional.of(mine));

        service.join("miembro@x.com", "ABCDEFGH");

        verify(players, never()).save(any());
        verify(webSocket, never()).notifyTrackerChanged(any(), any());
    }

    @Test
    void aNameAlreadyTakenByAnotherPlayerGetsANumber() {
        when(trackers.findByJoinCode("ABCDEFGH")).thenReturn(Optional.of(tracker));
        ScoreTrackerPlayer other = ScoreTrackerPlayer.builder().id(100L).trackerId(10L).name("Carla").userId(1L).build();
        when(players.findByTrackerIdOrderByPositionAsc(10L)).thenReturn(List.of(other));

        service.join("ajeno@x.com", "ABCDEFGH");

        assertThat(savedPlayer().getName()).isEqualTo("Carla (2)");
    }
}
