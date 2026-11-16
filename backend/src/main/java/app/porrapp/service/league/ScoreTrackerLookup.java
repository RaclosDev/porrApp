package app.porrapp.service.league;

import app.porrapp.exception.BusinessException;
import app.porrapp.model.ScoreDay;
import app.porrapp.model.ScoreGame;
import app.porrapp.model.ScoreSessionPlayer;
import app.porrapp.model.ScoreTrackerPlayer;
import app.porrapp.model.ScoreTrackerRound;
import app.porrapp.model.ScoreTrackerSession;
import app.porrapp.repository.ScoreDayRepository;
import app.porrapp.repository.ScoreGameRepository;
import app.porrapp.repository.ScoreSessionPlayerRepository;
import app.porrapp.repository.ScoreTrackerPlayerRepository;
import app.porrapp.repository.ScoreTrackerRoundRepository;
import app.porrapp.repository.ScoreTrackerSessionRepository;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/** Búsquedas y comprobaciones comunes del marcador: filas de una liga y participantes de una partida. */
@Component
@RequiredArgsConstructor
class ScoreTrackerLookup {

    private final ScoreGameRepository games;
    private final ScoreTrackerPlayerRepository players;
    private final ScoreTrackerSessionRepository sessions;
    private final ScoreTrackerRoundRepository rounds;
    private final ScoreDayRepository days;
    private final ScoreSessionPlayerRepository sessionPlayers;

    void addParticipants(Long sessionId, Set<Long> participants, Collection<Long> wanted) {
        for (Long id : wanted) {
            if (participants.add(id)) sessionPlayers.save(new ScoreSessionPlayer(sessionId, id));
        }
    }

    Set<Long> participantIds(Long sessionId) {
        return sessionPlayers.findBySessionId(sessionId).stream().map(ScoreSessionPlayer::getPlayerId)
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    Set<Long> playerIds(Long leagueId) {
        return players.findByLeagueIdOrderByPositionAsc(leagueId).stream().map(ScoreTrackerPlayer::getId)
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    /** Jugadores pedidos, comprobando que son de la liga; al menos uno. */
    List<Long> chosenPlayers(Long leagueId, List<Long> wanted) {
        List<Long> ids = wanted == null ? List.of() : wanted.stream().filter(Objects::nonNull).distinct().toList();
        if (ids.isEmpty()) throw BusinessException.badRequest("Elige al menos un jugador");
        if (!playerIds(leagueId).containsAll(ids)) throw BusinessException.badRequest("Jugador no válido");
        return ids;
    }

    ScoreTrackerRound roundOf(Long leagueId, Long roundId) {
        return rounds.findById(roundId).filter(found -> found.getLeagueId().equals(leagueId))
                .orElseThrow(() -> BusinessException.notFound("Ronda no encontrada"));
    }

    ScoreTrackerSession sessionOf(Long leagueId, Long sessionId) {
        return sessions.findById(sessionId).filter(found -> found.getLeagueId().equals(leagueId))
                .orElseThrow(() -> BusinessException.notFound("Partida no encontrada"));
    }

    ScoreDay dayOf(Long leagueId, Long dayId) {
        return days.findById(dayId).filter(found -> found.getLeagueId().equals(leagueId))
                .orElseThrow(() -> BusinessException.notFound("Día de juego no encontrado"));
    }

    ScoreGame firstGame(Long leagueId) {
        return games.findByLeagueIdOrderByIdAsc(leagueId).stream().findFirst()
                .orElseThrow(() -> BusinessException.badRequest("La liga no tiene ningún juego"));
    }

    ScoreGame gameOf(Long leagueId, Long gameId) {
        return games.findById(gameId).filter(game -> game.getLeagueId().equals(leagueId))
                .orElseThrow(() -> BusinessException.badRequest("Juego no válido"));
    }
}
