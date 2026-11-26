package app.porrapp.service.league;

import app.porrapp.exception.BusinessException;
import app.porrapp.model.League;
import app.porrapp.model.ScoreTrackerPlayer;
import app.porrapp.model.UserAccount;
import app.porrapp.dto.PokerDTO.Entry;
import app.porrapp.repository.PokerSessionRepository;
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

    static final int MAX_POKER_ROSTER = 100;

    private final ScoreTrackerPlayerRepository players;
    private final PokerSessionRepository sessions;

    /** Apunta al usuario como jugador de la liga si aún no lo está. Repetirlo no duplica nada. */
    @Transactional
    public void memberJoined(League league, UserAccount account) {
        Long leagueId = league.getId();
        Long userId = account.getId();
        if (players.findByLeagueIdAndUserId(leagueId, userId).isPresent()) return;
        List<ScoreTrackerPlayer> all = players.findByLeagueIdOrderByPositionAsc(leagueId);
        String wanted = ScoreTrackerService.displayName(account);
        int maxPlayers = league.isPoker() ? MAX_POKER_ROSTER : ScoreTrackerService.MAX_PLAYERS;
        if (league.isPoker() && all.size() >= maxPlayers) {
            throw BusinessException.conflict("La liga ha alcanzado el máximo de jugadores");
        }
        if (all.size() < maxPlayers) {
            players.save(ScoreTrackerPlayer.builder().leagueId(leagueId)
                    .name(ScoreTrackerService.freeName(wanted, all)).userId(userId).position(all.size()).build());
        }
    }

    /**
     * Cuando el usuario cambia de apodo, sus jugadores siguen el cambio: el de la liga y su inscripción
     * en el torneo abierto. Si el organizador ya le puso otro nombre al jugador, no se toca.
     */
    @Transactional
    public void memberRenamed(UserAccount account, String oldName) {
        for (ScoreTrackerPlayer player : players.findByUserIdOrderByLeagueIdAsc(account.getId())) {
            if (!player.getName().equals(oldName)) continue;
            Long leagueId = player.getLeagueId();
            List<ScoreTrackerPlayer> others = players.findByLeagueIdOrderByPositionAsc(leagueId).stream()
                    .filter(other -> !other.getId().equals(player.getId())).toList();
            String newName = ScoreTrackerService.freeName(ScoreTrackerService.displayName(account), others);
            player.setName(newName);
            sessions.findByLeagueIdAndClosedAtIsNullOrderByScheduledOnAscIdAsc(leagueId).forEach(session -> session.setEntries(
                    session.getEntries().stream()
                            .map(entry -> entry.playerId() == player.getId()
                                    ? entry.renamed(newName)
                                    : entry)
                            .toList()));
        }
    }

    /** La pertenencia controla el acceso; el vínculo histórico se conserva si el usuario vuelve. */
    @Transactional
    public void memberLeft(Long leagueId, Long userId) {
        // El historial sigue perteneciendo a la misma persona tras salir de la liga.
    }
}
