package app.porrapp.service.league;

import app.porrapp.dto.ScoreTrackerDTO;
import app.porrapp.dto.ScoreTrackerDTO.Player;
import app.porrapp.dto.ScoreTrackerRoundRequest;
import app.porrapp.exception.BusinessException;
import app.porrapp.model.League;
import app.porrapp.model.ScoreDay;
import app.porrapp.model.ScoreGame;
import app.porrapp.model.ScoreTrackerRound;
import app.porrapp.model.ScoreTrackerRoundChange;
import app.porrapp.model.ScoreTrackerScore;
import app.porrapp.model.ScoreTrackerSession;
import app.porrapp.repository.ScoreTrackerRoundChangeRepository;
import app.porrapp.repository.ScoreTrackerRoundRepository;
import app.porrapp.repository.ScoreTrackerScoreRepository;
import app.porrapp.repository.ScoreTrackerSessionRepository;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeMap;
import java.util.stream.Collectors;

/** Rondas de una partida del marcador: apuntarlas, corregirlas, borrarlas y su historial de cambios. */
@Service
@RequiredArgsConstructor
public class ScoreTrackerRoundService {

    private static final ObjectMapper JSON = new ObjectMapper();

    private final ScoreTrackerService tracker;
    private final ScoreTrackerLookup lookup;
    private final ScoreTrackerSessionRepository sessions;
    private final ScoreTrackerRoundRepository rounds;
    private final ScoreTrackerRoundChangeRepository roundChanges;
    private final ScoreTrackerScoreRepository scores;

    /**
     * Apunta una ronda en una partida abierta. Sin partida, va a la última; si ya está terminada se
     * empieza otra del mismo juego (así sigue funcionando quien apunta sin elegir partida).
     */
    @Transactional
    public ScoreTrackerDTO addRound(String email, Long leagueId, ScoreTrackerRoundRequest request) {
        Long userId = tracker.userId(email);
        League league = tracker.visible(userId, leagueId);
        String fingerprint = requestFingerprint(request);
        if (request.clientRequestId() != null) {
            ScoreTrackerRound previous = rounds.findByLeagueIdAndClientRequestId(leagueId, request.clientRequestId())
                    .orElse(null);
            if (previous != null) {
                if (!fingerprint.equals(previous.getRequestFingerprint())) {
                    throw BusinessException.conflict("Esta ronda tiene un identificador ya usado para otros datos");
                }
                return tracker.view(league, userId);
            }
        }
        if (rounds.countByLeagueId(leagueId) >= ScoreTrackerService.MAX_ROUNDS) {
            throw BusinessException.badRequest("Esta liga ha llegado al máximo de rondas");
        }
        ScoreTrackerSession session;
        if (request.sessionId() != null) {
            session = lookup.sessionOf(leagueId, request.sessionId());
            if (!session.isOpen()) {
                throw BusinessException.conflict("La partida está terminada: reábrela para apuntar");
            }
            ScoreDay day = lookup.dayOf(leagueId, session.getDayId());
            if (!day.isOpen()) throw BusinessException.conflict("El día de juego está terminado");
        } else {
            session = tracker.sessionForRound(leagueId, userId);
        }
        Map<Long, Integer> points = roundPoints(leagueId, session, request);
        ScoreGame sessionGame = lookup.gameOf(leagueId, session.getGameId());
        if (sessionGame.isDirect() && rounds.findByLeagueIdOrderByIdAsc(leagueId).stream()
                .anyMatch(existing -> existing.getSessionId().equals(session.getId()))) {
            throw BusinessException.conflict("Esta partida ya tiene ganador");
        }
        String note = ScoreTrackerService.clean(request.note());
        ScoreTrackerRound round = rounds.save(ScoreTrackerRound.builder().leagueId(leagueId)
                .sessionId(session.getId()).note(note.isEmpty() ? null : note).createdByUserId(userId)
                .clientRequestId(request.clientRequestId()).requestFingerprint(fingerprint).build());
        points.forEach((playerId, value) -> scores.save(ScoreTrackerScore.builder().roundId(round.getId())
                .playerId(playerId).points(value).build()));
        recordRoundChange(leagueId, round.getId(), userId, "CREATED", null, roundState(round, points));
        if (sessionGame.isDirect() || targetReached(session, sessionGame)) {
            session.setEndedAt(Instant.now());
            sessions.save(session);
        }
        return tracker.changed(league, userId);
    }

    private boolean targetReached(ScoreTrackerSession session, ScoreGame game) {
        if (game.getTargetWins() == null) return false;
        List<Long> roundIds = rounds.findBySessionIdOrderByIdAsc(session.getId()).stream()
                .map(ScoreTrackerRound::getId).toList();
        if (roundIds.isEmpty()) return false;
        Map<Long, Map<Long, Integer>> pointsByRound = new LinkedHashMap<>();
        Set<Long> scored = new HashSet<>();
        for (ScoreTrackerScore score : scores.findByRoundIdIn(roundIds)) {
            pointsByRound.computeIfAbsent(score.getRoundId(), key -> new LinkedHashMap<>())
                    .put(score.getPlayerId(), score.getPoints());
            scored.add(score.getPlayerId());
        }
        List<Player> participants = scored.stream().map(id -> new Player(id, "")).toList();
        return ScoreTrackerStandings.rank(participants, !game.isWins() && game.isLowerWins(),
                        new ArrayList<>(pointsByRound.values()), true).stream()
                .anyMatch(row -> row.roundsWon() >= game.getTargetWins());
    }

    /** Corrige una ronda: sustituye sus puntos (o quién la ganó) y su nota. */
    @Transactional
    public ScoreTrackerDTO editRound(String email, Long leagueId, Long roundId, ScoreTrackerRoundRequest request) {
        Long userId = tracker.userId(email);
        League league = tracker.visible(userId, leagueId);
        ScoreTrackerRound round = lookup.roundOf(leagueId, roundId);
        ScoreTrackerSession session = lookup.sessionOf(leagueId, round.getSessionId());
        ScoreTrackerService.requireEditable(league, userId, session);
        requireRevision(round, request.expectedRevision());
        Map<Long, Integer> points = roundPoints(leagueId, session, request);
        List<ScoreTrackerScore> oldScores = scores.findByRoundIdIn(List.of(roundId));
        Map<Long, Integer> beforePoints = oldScores.stream().collect(Collectors.toMap(
                ScoreTrackerScore::getPlayerId, ScoreTrackerScore::getPoints));
        String before = roundState(round, beforePoints);
        Map<Long, Integer> afterPoints = new LinkedHashMap<>(points);
        for (ScoreTrackerScore score : oldScores) {
            Integer value = points.remove(score.getPlayerId());
            if (value == null) {
                scores.delete(score);
            } else {
                score.setPoints(value);
                scores.save(score);
            }
        }
        points.forEach((playerId, value) -> scores.save(ScoreTrackerScore.builder().roundId(roundId)
                .playerId(playerId).points(value).build()));
        String note = ScoreTrackerService.clean(request.note());
        round.setNote(note.isEmpty() ? null : note);
        Instant editedAt = Instant.now();
        round.setUpdatedAt(editedAt.isAfter(round.getUpdatedAt())
                ? editedAt : round.getUpdatedAt().plusNanos(1));
        rounds.save(round);
        rounds.flush();
        recordRoundChange(leagueId, roundId, userId, "UPDATED", before, roundState(round, afterPoints));
        if (session.isOpen() && targetReached(session, lookup.gameOf(leagueId, session.getGameId()))) {
            session.setEndedAt(Instant.now());
            sessions.save(session);
        }
        return tracker.changed(league, userId);
    }

    /** Cualquier miembro borra rondas de una partida abierta; en una terminada, solo el administrador. */
    @Transactional
    public ScoreTrackerDTO deleteRound(String email, Long leagueId, Long roundId, Integer expectedRevision) {
        Long userId = tracker.userId(email);
        League league = tracker.visible(userId, leagueId);
        ScoreTrackerRound round = lookup.roundOf(leagueId, roundId);
        ScoreTrackerService.requireEditable(league, userId, lookup.sessionOf(leagueId, round.getSessionId()));
        requireRevision(round, expectedRevision);
        Map<Long, Integer> beforePoints = scores.findByRoundIdIn(List.of(roundId)).stream()
                .collect(Collectors.toMap(ScoreTrackerScore::getPlayerId, ScoreTrackerScore::getPoints));
        recordRoundChange(leagueId, roundId, userId, "DELETED", roundState(round, beforePoints), null);
        rounds.delete(round);
        return tracker.changed(league, userId);
    }

    private static String roundState(ScoreTrackerRound round, Map<Long, Integer> points) {
        Map<String, Object> state = new LinkedHashMap<>();
        state.put("sessionId", round.getSessionId());
        state.put("note", round.getNote());
        state.put("scores", new TreeMap<>(points));
        try {
            return JSON.writeValueAsString(state);
        } catch (JsonProcessingException failure) {
            throw new IllegalStateException(failure);
        }
    }

    private void recordRoundChange(Long leagueId, Long roundId, Long actorId, String action,
                                   String before, String after) {
        roundChanges.save(ScoreTrackerRoundChange.builder().leagueId(leagueId).roundId(roundId)
                .actorUserId(actorId).action(action).beforeState(before).afterState(after).build());
    }

    @Transactional(readOnly = true)
    public List<ScoreTrackerRoundChange> roundHistory(String email, Long leagueId, Long roundId) {
        tracker.visible(tracker.userId(email), leagueId);
        return roundChanges.findByLeagueIdAndRoundIdOrderByIdAsc(leagueId, roundId);
    }

    private static void requireRevision(ScoreTrackerRound round, Integer expected) {
        if (expected == null || expected != round.getRevision()) {
            throw BusinessException.conflict("La ronda ha cambiado. Actualiza la partida antes de corregirla");
        }
    }

    private static String requestFingerprint(ScoreTrackerRoundRequest request) {
        String data = Objects.toString(request.sessionId(), "") + "|" + Objects.toString(request.note(), "")
                + "|" + new TreeMap<>(request.scores() == null ? Map.of() : request.scores())
                + "|" + (request.winners() == null ? List.of() : request.winners().stream().sorted().toList());
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(data.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException failure) {
            throw new IllegalStateException(failure);
        }
    }

    /**
     * Puntos que guarda una ronda, solo de quienes la jugaron. En los juegos por puntos, los que vienen en la
     * petición; en los de victorias, 1 a quien ganó y 0 al resto de participantes. Quien apunta puntos sin
     * ser participante pasa a serlo.
     */
    private Map<Long, Integer> roundPoints(Long leagueId, ScoreTrackerSession session,
                                           ScoreTrackerRoundRequest request) {
        Set<Long> leaguePlayers = lookup.playerIds(leagueId);
        ScoreGame game = lookup.gameOf(leagueId, session.getGameId());
        Map<Long, Integer> given = request.scores() == null ? Map.of() : request.scores();
        for (Map.Entry<Long, Integer> entry : given.entrySet()) {
            if (!leaguePlayers.contains(entry.getKey()) || entry.getValue() == null) {
                throw BusinessException.badRequest("Jugador no válido");
            }
            if (Math.abs((long) entry.getValue()) > ScoreTrackerService.MAX_POINTS) {
                throw BusinessException.badRequest("Los puntos tienen que estar entre -" + ScoreTrackerService.MAX_POINTS + " y " + ScoreTrackerService.MAX_POINTS);
            }
        }
        Set<Long> participants = lookup.participantIds(session.getId());
        Map<Long, Integer> points = new LinkedHashMap<>();
        if (game.isWins()) {
            Set<Long> winners = new LinkedHashSet<>(request.winners() != null && !request.winners().isEmpty()
                    ? request.winners()
                    : given.entrySet().stream().filter(entry -> entry.getValue() > 0).map(Map.Entry::getKey).toList());
            if (winners.isEmpty()) throw BusinessException.badRequest("Marca quién ha ganado la ronda");
            if (!leaguePlayers.containsAll(winners)) throw BusinessException.badRequest("Jugador no válido");
            lookup.addParticipants(session.getId(), participants, winners);
            participants.forEach(id -> points.put(id, winners.contains(id) ? 1 : 0));
        } else {
            if (given.isEmpty()) throw BusinessException.badRequest("Apunta los puntos de al menos un jugador");
            lookup.addParticipants(session.getId(), participants, given.keySet());
            points.putAll(given);
        }
        return points;
    }
}
