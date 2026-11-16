package app.porrapp.service.league;

import app.porrapp.dto.ScoreTrackerDTO;
import app.porrapp.exception.BusinessException;
import app.porrapp.model.League;
import app.porrapp.model.ScoreDayPlayer;
import app.porrapp.model.ScoreSessionPlayer;
import app.porrapp.model.ScoreTrackerPlayer;
import app.porrapp.model.ScoreTrackerScore;
import app.porrapp.repository.ScoreDayPlayerRepository;
import app.porrapp.repository.ScoreSessionPlayerRepository;
import app.porrapp.repository.ScoreTrackerPlayerRepository;
import app.porrapp.repository.ScoreTrackerScoreRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/** Los jugadores de una liga de marcador: apuntarlos, decir cuál es uno, renombrarlos, quitarlos y juntarlos. */
@Service
@RequiredArgsConstructor
public class ScoreTrackerPlayerService {

    private final ScoreTrackerService tracker;
    private final ScoreboardRoster roster;
    private final ScoreTrackerPlayerRepository players;
    private final ScoreTrackerScoreRepository scores;
    private final ScoreSessionPlayerRepository sessionPlayers;
    private final ScoreDayPlayerRepository dayPlayers;

    @Transactional
    public ScoreTrackerDTO addPlayer(String email, Long leagueId, String name) {
        Long userId = tracker.userId(email);
        League league = tracker.visible(userId, leagueId);
        String clean = ScoreTrackerService.clean(name);
        if (clean.isEmpty()) throw BusinessException.badRequest("Escribe el nombre del jugador");
        List<ScoreTrackerPlayer> all = players.findByLeagueIdOrderByPositionAsc(leagueId);
        if (all.size() >= ScoreTrackerService.MAX_PLAYERS) throw BusinessException.badRequest("Máximo " + ScoreTrackerService.MAX_PLAYERS + " jugadores");
        if (all.stream().anyMatch(player -> player.getName().equalsIgnoreCase(clean))) {
            throw BusinessException.badRequest("Ya hay un jugador con ese nombre");
        }
        players.save(ScoreTrackerPlayer.builder().leagueId(leagueId).name(clean).position(all.size()).build());
        return tracker.changed(league, userId);
    }

    /**
     * El usuario dice cuál de los jugadores es él, para que en cada móvil se vea quién es quién. Solo uno
     * por liga (cambiar de jugador libera el anterior) y nadie puede quitarle el suyo a otro.
     */
    @Transactional
    public ScoreTrackerDTO claimPlayer(String email, Long leagueId, Long playerId) {
        Long userId = tracker.userId(email);
        League league = tracker.visible(userId, leagueId);
        ScoreTrackerPlayer target = players.findWithLockById(playerId)
                .filter(found -> found.getLeagueId().equals(leagueId))
                .orElseThrow(() -> BusinessException.badRequest("Jugador no válido"));
        if (target.getUserId() != null && !target.getUserId().equals(userId)) {
            throw BusinessException.conflict("Ese jugador ya es de otra persona");
        }
        if (userId.equals(target.getUserId())) return tracker.view(league, userId);
        players.findByLeagueIdAndUserId(leagueId, userId).ifPresent(previous -> {
            previous.setUserId(null);
            players.saveAndFlush(previous);
            // El que se creó al unirse y nunca ha jugado sobra: ahora es el jugador que reclama.
            if (!hasPlayed(previous.getId())) {
                players.delete(previous);
                players.flush();
            }
        });
        target.setUserId(userId);
        players.save(target);
        return tracker.changed(league, userId);
    }

    @Transactional
    public ScoreTrackerDTO releasePlayer(String email, Long leagueId) {
        Long userId = tracker.userId(email);
        League league = tracker.visible(userId, leagueId);
        roster.memberLeft(leagueId, userId);
        return tracker.changed(league, userId);
    }

    private boolean hasPlayed(Long playerId) {
        return !scores.findByPlayerIdIn(List.of(playerId)).isEmpty()
                || !sessionPlayers.findByPlayerId(playerId).isEmpty();
    }

    private ScoreTrackerPlayer playerOf(Long leagueId, Long playerId) {
        return players.findById(playerId).filter(found -> found.getLeagueId().equals(leagueId))
                .orElseThrow(() -> BusinessException.badRequest("Jugador no válido"));
    }

    /** Cambia el nombre de un jugador: lo hace el administrador o la persona que es ese jugador. */
    @Transactional
    public ScoreTrackerDTO renamePlayer(String email, Long leagueId, Long playerId, String name) {
        Long userId = tracker.userId(email);
        League league = tracker.visible(userId, leagueId);
        ScoreTrackerPlayer player = playerOf(leagueId, playerId);
        if (!ScoreTrackerService.administers(league, userId) && !userId.equals(player.getUserId())) {
            throw BusinessException.forbidden("Solo el administrador o ese jugador pueden cambiarle el nombre");
        }
        String cleaned = ScoreTrackerService.clean(name);
        if (cleaned.isEmpty()) throw BusinessException.badRequest("Escribe el nombre del jugador");
        String wanted = cleaned.length() > ScoreTrackerService.MAX_NAME_LENGTH ? cleaned.substring(0, ScoreTrackerService.MAX_NAME_LENGTH) : cleaned;
        if (players.findByLeagueIdOrderByPositionAsc(leagueId).stream()
                .anyMatch(other -> !other.getId().equals(playerId) && other.getName().equalsIgnoreCase(wanted))) {
            throw BusinessException.badRequest("Ya hay un jugador con ese nombre");
        }
        player.setName(wanted);
        players.save(player);
        return tracker.changed(league, userId);
    }

    /** Quita un jugador apuntado por error: solo el administrador y solo si no ha jugado ninguna partida. */
    @Transactional
    public ScoreTrackerDTO deletePlayer(String email, Long leagueId, Long playerId) {
        Long userId = tracker.userId(email);
        League league = tracker.owned(userId, leagueId);
        ScoreTrackerPlayer player = playerOf(leagueId, playerId);
        if (player.getUserId() != null) {
            throw BusinessException.conflict("Ese jugador es de una persona de la liga: no se puede quitar");
        }
        if (hasPlayed(playerId)) {
            throw BusinessException.conflict("Ese jugador ya ha jugado: júntalo con otro en vez de quitarlo");
        }
        players.delete(player);
        players.flush();
        return tracker.changed(league, userId);
    }

    /**
     * Junta dos jugadores que eran la misma persona: las rondas, partidas y días de uno pasan al otro y el
     * primero desaparece. Si el que se quita era de alguien, su cuenta pasa al que queda.
     */
    @Transactional
    public ScoreTrackerDTO mergePlayer(String email, Long leagueId, Long playerId, Long intoPlayerId) {
        Long userId = tracker.userId(email);
        League league = tracker.owned(userId, leagueId);
        if (playerId.equals(intoPlayerId)) throw BusinessException.badRequest("Elige otro jugador");
        ScoreTrackerPlayer source = playerOf(leagueId, playerId);
        ScoreTrackerPlayer target = playerOf(leagueId, intoPlayerId);
        if (source.getUserId() != null && target.getUserId() != null) {
            throw BusinessException.conflict("Los dos jugadores son de personas distintas");
        }
        List<ScoreTrackerScore> moved = scores.findByPlayerIdIn(List.of(playerId));
        Set<Long> targetRounds = scores.findByPlayerIdIn(List.of(intoPlayerId)).stream()
                .map(ScoreTrackerScore::getRoundId).collect(Collectors.toSet());
        if (moved.stream().anyMatch(score -> targetRounds.contains(score.getRoundId()))) {
            throw BusinessException.conflict("Los dos jugaron la misma ronda: no son la misma persona");
        }
        scores.deleteAll(moved);
        scores.flush();
        moved.forEach(score -> scores.save(ScoreTrackerScore.builder().roundId(score.getRoundId())
                .playerId(intoPlayerId).points(score.getPoints()).build()));

        List<ScoreSessionPlayer> sourceSessions = sessionPlayers.findByPlayerId(playerId);
        Set<Long> targetSessions = sessionPlayers.findByPlayerId(intoPlayerId).stream()
                .map(ScoreSessionPlayer::getSessionId).collect(Collectors.toSet());
        sessionPlayers.deleteAll(sourceSessions);
        sessionPlayers.flush();
        sourceSessions.stream().map(ScoreSessionPlayer::getSessionId).filter(id -> !targetSessions.contains(id))
                .forEach(id -> sessionPlayers.save(new ScoreSessionPlayer(id, intoPlayerId)));

        List<ScoreDayPlayer> sourceDays = dayPlayers.findByPlayerId(playerId);
        Set<Long> targetDays = dayPlayers.findByPlayerId(intoPlayerId).stream()
                .map(ScoreDayPlayer::getDayId).collect(Collectors.toSet());
        dayPlayers.deleteAll(sourceDays);
        dayPlayers.flush();
        sourceDays.stream().map(ScoreDayPlayer::getDayId).filter(id -> !targetDays.contains(id))
                .forEach(id -> dayPlayers.save(new ScoreDayPlayer(id, intoPlayerId)));

        Long account = source.getUserId();
        players.delete(source);
        players.flush();
        if (account != null) {
            target.setUserId(account);
            players.save(target);
        }
        return tracker.changed(league, userId);
    }
}
