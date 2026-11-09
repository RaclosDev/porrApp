package app.porrapp.service.league;

import app.porrapp.dto.ScoreTrackerRoundRequest;
import app.porrapp.exception.BusinessException;
import app.porrapp.model.ScoreTracker;
import app.porrapp.model.ScoreTrackerMember;
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

import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
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
    private final ScoreTrackerService service =
            new ScoreTrackerService(trackers, members, players, sessions, rounds, scores, users, webSocket);

    @BeforeEach
    void setUp() {
        stubUser("dueno@x.com", 1L);
        stubUser("miembro@x.com", 2L);
        stubUser("ajeno@x.com", 3L);
        ScoreTracker tracker = ScoreTracker.builder().id(10L).ownerUserId(1L).name("Mus").joinCode("ABCDEFGH").build();
        when(trackers.findById(10L)).thenReturn(Optional.of(tracker));
        when(members.existsById(new ScoreTrackerMember.Key(10L, 2L))).thenReturn(true);
    }

    private void stubUser(String email, Long id) {
        UserAccount user = new UserAccount();
        user.setId(id);
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
}
