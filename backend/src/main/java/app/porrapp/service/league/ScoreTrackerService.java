package app.porrapp.service.league;

import app.porrapp.dto.ScoreTrackerDTO;
import app.porrapp.dto.ScoreTrackerDTO.Player;
import app.porrapp.dto.ScoreTrackerDTO.Round;
import app.porrapp.dto.ScoreTrackerDTO.Session;
import app.porrapp.dto.ScoreTrackerDTO.Standing;
import app.porrapp.dto.ScoreTrackerRequest;
import app.porrapp.dto.ScoreTrackerRoundRequest;
import app.porrapp.dto.ScoreTrackerSummaryDTO;
import app.porrapp.exception.BusinessException;
import app.porrapp.model.ScoreTracker;
import app.porrapp.model.ScoreTrackerMember;
import app.porrapp.model.ScoreTrackerPlayer;
import app.porrapp.model.ScoreTrackerRound;
import app.porrapp.model.ScoreTrackerScore;
import app.porrapp.model.ScoreTrackerSession;
import app.porrapp.repository.ScoreTrackerMemberRepository;
import app.porrapp.repository.ScoreTrackerPlayerRepository;
import app.porrapp.repository.ScoreTrackerRepository;
import app.porrapp.repository.ScoreTrackerRoundRepository;
import app.porrapp.repository.ScoreTrackerScoreRepository;
import app.porrapp.repository.ScoreTrackerSessionRepository;
import app.porrapp.repository.UserAccountRepository;
import app.porrapp.service.notification.WebSocketService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Marcadores de juegos de mesa o de cartas: el creador apunta partidas y quien tiene el código las ve
 * en directo, por sesiones y acumuladas. No hay predicciones ni puntos de porra.
 */
@Service
@RequiredArgsConstructor
public class ScoreTrackerService {

    static final int MAX_TRACKERS_PER_OWNER = 30;
    static final int MAX_PLAYERS = 20;
    static final int MAX_ROUNDS = 2000;
    static final int MAX_POINTS = 1_000_000;
    private static final String CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final int CODE_LENGTH = 8;
    private static final SecureRandom RANDOM = new SecureRandom();

    private final ScoreTrackerRepository trackers;
    private final ScoreTrackerMemberRepository members;
    private final ScoreTrackerPlayerRepository players;
    private final ScoreTrackerSessionRepository sessions;
    private final ScoreTrackerRoundRepository rounds;
    private final ScoreTrackerScoreRepository scores;
    private final UserAccountRepository users;
    private final WebSocketService webSocketService;

    private Long userId(String email) {
        return users.findByGoogleEmail(email)
                .orElseThrow(() -> BusinessException.forbidden("Usuario no encontrado")).getId();
    }

    /** El marcador, si el usuario lo ve; si no existe o no es suyo, el mismo error (no se filtra su existencia). */
    private ScoreTracker visible(Long userId, Long trackerId) {
        ScoreTracker tracker = trackers.findById(trackerId)
                .orElseThrow(() -> BusinessException.notFound("Marcador no encontrado"));
        if (!tracker.getOwnerUserId().equals(userId)
                && !members.existsById(new ScoreTrackerMember.Key(trackerId, userId))) {
            throw BusinessException.notFound("Marcador no encontrado");
        }
        return tracker;
    }

    private ScoreTracker owned(Long userId, Long trackerId) {
        ScoreTracker tracker = visible(userId, trackerId);
        if (!tracker.getOwnerUserId().equals(userId)) {
            throw BusinessException.forbidden("Solo quien creó el marcador puede cambiarlo");
        }
        return tracker;
    }

    private static String clean(String value) {
        return value == null ? "" : value.trim().replaceAll("\\s+", " ");
    }

    private String newCode() {
        for (int attempt = 0; attempt < 10; attempt++) {
            StringBuilder code = new StringBuilder();
            for (int i = 0; i < CODE_LENGTH; i++) code.append(CODE_ALPHABET.charAt(RANDOM.nextInt(CODE_ALPHABET.length())));
            if (trackers.findByJoinCode(code.toString()).isEmpty()) return code.toString();
        }
        throw BusinessException.conflict("No se pudo generar el código, inténtalo de nuevo");
    }

    @Transactional
    public ScoreTrackerDTO create(String email, ScoreTrackerRequest request) {
        Long userId = userId(email);
        if (trackers.countByOwnerUserId(userId) >= MAX_TRACKERS_PER_OWNER) {
            throw BusinessException.badRequest("Has llegado al máximo de marcadores");
        }
        String name = clean(request.name());
        if (name.isEmpty()) throw BusinessException.badRequest("Ponle nombre al marcador");
        List<String> names = request.players() == null ? List.of()
                : request.players().stream().map(ScoreTrackerService::clean).filter(n -> !n.isEmpty()).toList();
        if (names.size() < 2 || names.size() > MAX_PLAYERS) {
            throw BusinessException.badRequest("Añade entre 2 y " + MAX_PLAYERS + " jugadores");
        }
        if (names.stream().map(n -> n.toLowerCase(Locale.ROOT)).distinct().count() != names.size()) {
            throw BusinessException.badRequest("Los nombres de los jugadores no pueden repetirse");
        }
        String unit = clean(request.unit());
        ScoreTracker tracker = trackers.save(ScoreTracker.builder()
                .ownerUserId(userId).name(name).unit(unit.isEmpty() ? "puntos" : unit)
                .lowerWins(request.lowerWins()).joinCode(newCode()).build());
        for (int i = 0; i < names.size(); i++) {
            players.save(ScoreTrackerPlayer.builder().trackerId(tracker.getId()).name(names.get(i)).position(i).build());
        }
        sessions.save(ScoreTrackerSession.builder().trackerId(tracker.getId()).build());
        return view(tracker, userId);
    }

    @Transactional(readOnly = true)
    public List<ScoreTrackerSummaryDTO> mine(String email) {
        Long userId = userId(email);
        Set<Long> ids = members.findByUserId(userId).stream().map(ScoreTrackerMember::getTrackerId)
                .collect(Collectors.toCollection(HashSet::new));
        trackers.findAll().stream().filter(t -> t.getOwnerUserId().equals(userId)).forEach(t -> ids.add(t.getId()));
        if (ids.isEmpty()) return List.of();
        Map<Long, Long> playerCounts = players.findByTrackerIdIn(ids).stream()
                .collect(Collectors.groupingBy(ScoreTrackerPlayer::getTrackerId, Collectors.counting()));
        Map<Long, Long> roundCounts = rounds.findByTrackerIdIn(ids).stream()
                .collect(Collectors.groupingBy(ScoreTrackerRound::getTrackerId, Collectors.counting()));
        return trackers.findByIdInOrderByCreatedAtDesc(ids).stream()
                .map(t -> new ScoreTrackerSummaryDTO(t.getId(), t.getName(), t.getOwnerUserId().equals(userId),
                        playerCounts.getOrDefault(t.getId(), 0L).intValue(),
                        roundCounts.getOrDefault(t.getId(), 0L).intValue()))
                .toList();
    }

    @Transactional(readOnly = true)
    public ScoreTrackerDTO get(String email, Long trackerId) {
        Long userId = userId(email);
        return view(visible(userId, trackerId), userId);
    }

    /** Entra a un marcador con su código; repetir la petición no duplica nada. */
    @Transactional
    public ScoreTrackerDTO join(String email, String code) {
        Long userId = userId(email);
        ScoreTracker tracker = trackers.findByJoinCode(clean(code).toUpperCase(Locale.ROOT))
                .orElseThrow(() -> BusinessException.notFound("Código no válido"));
        ScoreTrackerMember.Key key = new ScoreTrackerMember.Key(tracker.getId(), userId);
        if (!tracker.getOwnerUserId().equals(userId) && !members.existsById(key)) {
            members.save(ScoreTrackerMember.builder().trackerId(tracker.getId()).userId(userId).build());
        }
        return view(tracker, userId);
    }

    @Transactional
    public ScoreTrackerDTO addRound(String email, Long trackerId, ScoreTrackerRoundRequest request) {
        Long userId = userId(email);
        ScoreTracker tracker = owned(userId, trackerId);
        List<ScoreTrackerPlayer> all = players.findByTrackerIdOrderByPositionAsc(trackerId);
        Set<Long> playerIds = all.stream().map(ScoreTrackerPlayer::getId).collect(Collectors.toSet());
        Map<Long, Integer> given = request.scores() == null ? Map.of() : request.scores();
        for (Map.Entry<Long, Integer> entry : given.entrySet()) {
            if (!playerIds.contains(entry.getKey()) || entry.getValue() == null) {
                throw BusinessException.badRequest("Jugador no válido");
            }
            if (Math.abs((long) entry.getValue()) > MAX_POINTS) {
                throw BusinessException.badRequest("Los puntos tienen que estar entre -" + MAX_POINTS + " y " + MAX_POINTS);
            }
        }
        if (rounds.countByTrackerId(trackerId) >= MAX_ROUNDS) {
            throw BusinessException.badRequest("Este marcador ha llegado al máximo de partidas");
        }
        ScoreTrackerSession session = sessions.findFirstByTrackerIdOrderByIdDesc(trackerId)
                .orElseGet(() -> sessions.save(ScoreTrackerSession.builder().trackerId(trackerId).build()));
        String note = clean(request.note());
        ScoreTrackerRound round = rounds.save(ScoreTrackerRound.builder().trackerId(trackerId)
                .sessionId(session.getId()).note(note.isEmpty() ? null : note).build());
        for (ScoreTrackerPlayer player : all) {
            scores.save(ScoreTrackerScore.builder().roundId(round.getId()).playerId(player.getId())
                    .points(given.getOrDefault(player.getId(), 0)).build());
        }
        return changed(tracker, userId);
    }

    @Transactional
    public ScoreTrackerDTO deleteRound(String email, Long trackerId, Long roundId) {
        Long userId = userId(email);
        ScoreTracker tracker = owned(userId, trackerId);
        ScoreTrackerRound round = rounds.findById(roundId)
                .filter(found -> found.getTrackerId().equals(trackerId))
                .orElseThrow(() -> BusinessException.notFound("Partida no encontrada"));
        rounds.delete(round);
        return changed(tracker, userId);
    }

    /** Empieza una sesión nueva (otro día de juego); si la actual está vacía no hace falta otra. */
    @Transactional
    public ScoreTrackerDTO newSession(String email, Long trackerId) {
        Long userId = userId(email);
        ScoreTracker tracker = owned(userId, trackerId);
        ScoreTrackerSession last = sessions.findFirstByTrackerIdOrderByIdDesc(trackerId).orElse(null);
        boolean lastHasRounds = last != null && rounds.findByTrackerIdOrderByIdAsc(trackerId).stream()
                .anyMatch(round -> round.getSessionId().equals(last.getId()));
        if (last == null || lastHasRounds) {
            sessions.save(ScoreTrackerSession.builder().trackerId(trackerId).build());
        }
        return changed(tracker, userId);
    }

    @Transactional
    public ScoreTrackerDTO addPlayer(String email, Long trackerId, String name) {
        Long userId = userId(email);
        ScoreTracker tracker = owned(userId, trackerId);
        String clean = clean(name);
        if (clean.isEmpty()) throw BusinessException.badRequest("Escribe el nombre del jugador");
        List<ScoreTrackerPlayer> all = players.findByTrackerIdOrderByPositionAsc(trackerId);
        if (all.size() >= MAX_PLAYERS) throw BusinessException.badRequest("Máximo " + MAX_PLAYERS + " jugadores");
        if (all.stream().anyMatch(player -> player.getName().equalsIgnoreCase(clean))) {
            throw BusinessException.badRequest("Ya hay un jugador con ese nombre");
        }
        players.save(ScoreTrackerPlayer.builder().trackerId(trackerId).name(clean).position(all.size()).build());
        return changed(tracker, userId);
    }

    /** Borra el marcador entero (solo su creador). */
    @Transactional
    public void delete(String email, Long trackerId) {
        Long userId = userId(email);
        ScoreTracker tracker = owned(userId, trackerId);
        Set<Long> audience = audience(tracker);
        trackers.delete(tracker);
        notifyAfterCommit(trackerId, audience);
    }

    /** Quien no es el creador deja de ver el marcador; el creador lo borra. */
    @Transactional
    public void leave(String email, Long trackerId) {
        Long userId = userId(email);
        ScoreTracker tracker = visible(userId, trackerId);
        if (tracker.getOwnerUserId().equals(userId)) {
            throw BusinessException.badRequest("Eres quien lo creó: bórralo si ya no lo quieres");
        }
        members.deleteById(new ScoreTrackerMember.Key(trackerId, userId));
    }

    private ScoreTrackerDTO changed(ScoreTracker tracker, Long userId) {
        notifyAfterCommit(tracker.getId(), audience(tracker));
        return view(tracker, userId);
    }

    private Set<Long> audience(ScoreTracker tracker) {
        Set<Long> audience = members.findByTrackerId(tracker.getId()).stream()
                .map(ScoreTrackerMember::getUserId).collect(Collectors.toCollection(HashSet::new));
        audience.add(tracker.getOwnerUserId());
        return audience;
    }

    /** El aviso sale cuando los datos ya están guardados: si no, el cliente recargaría lo de antes. */
    private void notifyAfterCommit(Long trackerId, Set<Long> audience) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            webSocketService.notifyTrackerChanged(trackerId, audience);
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                webSocketService.notifyTrackerChanged(trackerId, audience);
            }
        });
    }

    private ScoreTrackerDTO view(ScoreTracker tracker, Long userId) {
        Long trackerId = tracker.getId();
        List<Player> playerList = players.findByTrackerIdOrderByPositionAsc(trackerId).stream()
                .map(player -> new Player(player.getId(), player.getName())).toList();
        List<ScoreTrackerSession> sessionList = sessions.findByTrackerIdOrderByIdAsc(trackerId);
        List<ScoreTrackerRound> roundList = rounds.findByTrackerIdOrderByIdAsc(trackerId);
        Map<Long, Map<Long, Integer>> pointsByRound = new HashMap<>();
        Collection<Long> roundIds = roundList.stream().map(ScoreTrackerRound::getId).toList();
        if (!roundIds.isEmpty()) {
            for (ScoreTrackerScore score : scores.findByRoundIdIn(roundIds)) {
                pointsByRound.computeIfAbsent(score.getRoundId(), key -> new LinkedHashMap<>())
                        .put(score.getPlayerId(), score.getPoints());
            }
        }
        Map<Long, List<ScoreTrackerRound>> roundsBySession = roundList.stream()
                .collect(Collectors.groupingBy(ScoreTrackerRound::getSessionId));
        boolean lowerWins = tracker.isLowerWins();

        List<Session> sessionViews = new ArrayList<>();
        Map<Long, Integer> sessionsWon = new HashMap<>();
        int number = 1;
        for (ScoreTrackerSession session : sessionList) {
            List<ScoreTrackerRound> own = roundsBySession.getOrDefault(session.getId(), List.of());
            List<Standing> standings = ScoreTrackerStandings.rank(playerList, lowerWins,
                    own.stream().map(round -> pointsByRound.getOrDefault(round.getId(), Map.of())).toList(), Map.of());
            List<Long> winners = ScoreTrackerStandings.leaders(standings, own.size());
            winners.forEach(id -> sessionsWon.merge(id, 1, Integer::sum));
            sessionViews.add(new Session(session.getId(), number++, session.getStartedAt().toString(),
                    own.size(), standings, winners));
        }
        Map<Long, Integer> sessionNumbers = new HashMap<>();
        for (Session session : sessionViews) sessionNumbers.put(session.id(), session.number());
        int roundNumber = 1;
        List<Round> roundViews = new ArrayList<>();
        for (ScoreTrackerRound round : roundList) {
            roundViews.add(new Round(round.getId(), round.getSessionId(), roundNumber++, round.getNote(),
                    round.getCreatedAt().toString(), pointsByRound.getOrDefault(round.getId(), Map.of())));
        }
        List<Standing> overall = ScoreTrackerStandings.rank(playerList, lowerWins,
                roundList.stream().map(round -> pointsByRound.getOrDefault(round.getId(), Map.of())).toList(),
                sessionsWon);
        Long current = sessionList.isEmpty() ? null : sessionList.get(sessionList.size() - 1).getId();
        return new ScoreTrackerDTO(trackerId, tracker.getName(), tracker.getUnit(), lowerWins,
                tracker.getOwnerUserId().equals(userId), tracker.getJoinCode(), current, playerList,
                sessionViews, roundViews, overall);
    }
}
