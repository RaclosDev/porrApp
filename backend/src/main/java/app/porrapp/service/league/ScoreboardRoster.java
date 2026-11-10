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
 * Quién es quién en una liga de marcador: al entrar un miembro aparece como jugador (o toma el que el
 * administrador ya había apuntado con su nombre) y al salir su jugador se queda como un nombre suelto,
 * con todo su historial. Lo usan tanto el alta por código del marcador como el alta normal de ligas.
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
        ScoreTrackerPlayer sameName = all.stream()
                .filter(player -> player.getUserId() == null && player.getName().equalsIgnoreCase(wanted))
                .findFirst().orElse(null);
        if (sameName != null) {
            sameName.setUserId(userId);
            players.save(sameName);
        } else if (all.size() < ScoreTrackerService.MAX_PLAYERS) {
            players.save(ScoreTrackerPlayer.builder().leagueId(leagueId)
                    .name(ScoreTrackerService.freeName(wanted, all)).userId(userId).position(all.size()).build());
        }
    }

    /** El jugador del usuario deja de estar ligado a su cuenta; sus partidas se conservan. */
    @Transactional
    public void memberLeft(Long leagueId, Long userId) {
        players.findByLeagueIdAndUserId(leagueId, userId).ifPresent(mine -> {
            mine.setUserId(null);
            players.save(mine);
        });
    }
}
