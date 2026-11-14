package app.porrapp.service.league;

import app.porrapp.dto.PokerDTO.Entry;
import app.porrapp.model.PokerSession;
import app.porrapp.model.ScoreTrackerPlayer;
import app.porrapp.model.UserAccount;
import app.porrapp.repository.PokerSessionRepository;
import app.porrapp.repository.ScoreTrackerPlayerRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ScoreboardRosterRenameTest {

    @Mock private ScoreTrackerPlayerRepository players;
    @Mock private PokerSessionRepository sessions;
    @InjectMocks private ScoreboardRoster roster;

    @Test
    void elJugadorVinculadoYSuInscripcionSigueElNuevoApodo() {
        UserAccount account = new UserAccount();
        account.setId(7L);
        account.setParticipantName("Ak");
        ScoreTrackerPlayer player = ScoreTrackerPlayer.builder().id(3L).leagueId(9L).userId(7L)
                .name("Acacio Del campo").build();
        PokerSession session = new PokerSession();
        session.setEntries(List.of(new Entry(3L, "Acacio Del campo", 1, 0, null)));
        when(players.findByUserIdOrderByLeagueIdAsc(7L)).thenReturn(List.of(player));
        when(players.findByLeagueIdOrderByPositionAsc(9L)).thenReturn(List.of(player));
        when(sessions.findByLeagueIdAndClosedAtIsNull(9L)).thenReturn(Optional.of(session));

        roster.memberRenamed(account, "Acacio Del campo");

        assertThat(player.getName()).isEqualTo("Ak");
        assertThat(session.getEntries()).singleElement().satisfies(entry -> {
            assertThat(entry.name()).isEqualTo("Ak");
            assertThat(entry.rebuys()).isEqualTo(1);
        });
    }

    @Test
    void unNombreQueElOrganizadorHaCambiadoNoSeToca() {
        UserAccount account = new UserAccount();
        account.setId(7L);
        account.setParticipantName("Ak");
        ScoreTrackerPlayer player = ScoreTrackerPlayer.builder().id(3L).leagueId(9L).userId(7L)
                .name("El Capi").build();
        when(players.findByUserIdOrderByLeagueIdAsc(7L)).thenReturn(List.of(player));

        roster.memberRenamed(account, "Acacio Del campo");

        assertThat(player.getName()).isEqualTo("El Capi");
    }
}
