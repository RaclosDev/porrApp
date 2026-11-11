package app.porrapp.service.league;

import app.porrapp.model.League;
import app.porrapp.model.ScoreTrackerPlayer;
import app.porrapp.model.UserAccount;
import app.porrapp.repository.ScoreTrackerPlayerRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Quién es quién en una liga de marcador: al entrar un miembro aparece como jugador nuevo. Nunca se
 * atribuye un historial por coincidencia de nombre; el usuario puede reclamarlo expresamente.
 */
@Service
@RequiredArgsConstructor
public class ScoreboardRoster {

    private final ScoreTrackerPlayerRepository players;

    /** Apunta al usuario como jugador de la liga si aún no lo está. Repetirlo no duplica nada. */
    @Transactional
    public void memberJoined(League league, UserAccount account) {
        Long leagueId = league.getId();
        Long userId = account.getId();
        if (players.findByLeagueIdAndUserId(leagueId, userId).isPresent()) return;
        List<ScoreTrackerPlayer> all = players.findByLeagueIdOrderByPositionAsc(leagueId);
        String wanted = ScoreTrackerService.displayName(account);
        if (all.size() < ScoreTrackerService.MAX_PLAYERS) {
            players.save(ScoreTrackerPlayer.builder().leagueId(leagueId)
                    .name(ScoreTrackerService.freeName(wanted, all)).userId(userId).position(all.size()).build());
        }
    }

    /** La pertenencia controla el acceso; el vínculo histórico se conserva si el usuario vuelve. */
    @Transactional
    public void memberLeft(Long leagueId, Long userId) {
        // El historial sigue perteneciendo a la misma persona tras salir de la liga.
    }
}
