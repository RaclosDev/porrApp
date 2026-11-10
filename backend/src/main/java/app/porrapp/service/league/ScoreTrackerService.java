package app.porrapp.service.league;

import app.porrapp.dto.ScoreGameNameRequest;
import app.porrapp.dto.ScoreGameRequest;
import app.porrapp.dto.ScoreTrackerDTO;
import app.porrapp.dto.ScoreTrackerDTO.Day;
import app.porrapp.dto.ScoreTrackerDTO.Game;
import app.porrapp.dto.ScoreTrackerDTO.GameStandings;
import app.porrapp.dto.ScoreTrackerDTO.Player;
import app.porrapp.dto.ScoreTrackerDTO.Round;
import app.porrapp.dto.ScoreTrackerDTO.Session;
import app.porrapp.dto.ScoreTrackerDTO.Standing;
import app.porrapp.dto.ScoreTrackerRequest;
import app.porrapp.dto.ScoreTrackerRoundRequest;
import app.porrapp.dto.ScoreTrackerSummaryDTO;
import app.porrapp.exception.BusinessException;
import app.porrapp.model.League;
import app.porrapp.model.Membership;
import app.porrapp.model.ScoreDay;
import app.porrapp.model.ScoreDayPlayer;
import app.porrapp.model.ScoreGame;
import app.porrapp.model.ScoreSessionPlayer;
import app.porrapp.model.ScoreTrackerPlayer;
import app.porrapp.model.ScoreTrackerRound;
import app.porrapp.model.ScoreTrackerScore;
import app.porrapp.model.ScoreTrackerSession;
import app.porrapp.model.UserAccount;
import app.porrapp.repository.LeagueRepository;
import app.porrapp.repository.MembershipRepository;
import app.porrapp.repository.ScoreDayPlayerRepository;
import app.porrapp.repository.ScoreDayRepository;
import app.porrapp.repository.ScoreGameRepository;
import app.porrapp.repository.ScoreSessionPlayerRepository;
import app.porrapp.repository.ScoreTrackerPlayerRepository;
import app.porrapp.repository.ScoreTrackerRoundRepository;
import app.porrapp.repository.ScoreTrackerScoreRepository;
import app.porrapp.repository.ScoreTrackerSessionRepository;
import app.porrapp.repository.UserAccountRepository;
import app.porrapp.service.notification.WebSocketService;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Ligas de juegos de mesa o de cartas, como una hoja de papel: cada quedada es un día de juego con sus
 * asistentes; en él se juegan partidas de uno o varios juegos, cada una con sus participantes y sus
 * rondas. Cualquier miembro apunta; el administrador borra juegos y la liga. No hay predicciones ni puntos
 * de porra. Una liga de marcador es una {@link League} sin edición ni competición.
 */
@Service
@RequiredArgsConstructor
public class ScoreTrackerService {

    static final int MAX_TRACKERS_PER_OWNER = 30;
    static final int MAX_GAMES = 20;
    static final int MAX_PLAYERS = 20;
    static final int MAX_NAME_LENGTH = 40;
    static final int MAX_ROUNDS = 2000;
    static final int MAX_POINTS = 1_000_000;
    /** Un día de juego sin actividad durante este tiempo se da por terminado. */
    static final Duration STALE_DAY = Duration.ofHours(12);
    private static final String CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final int CODE_LENGTH = 8;
    private static final SecureRandom RANDOM = new SecureRandom();

    private final LeagueRepository leagues;
    private final MembershipRepository memberships;
    private final LeagueMembershipService membershipService;
    private final LeagueService leagueService;
    private final ScoreboardRoster roster;
    private final ScoreGameRepository games;
    private final ScoreTrackerPlayerRepository players;
    private final ScoreTrackerSessionRepository sessions;
    private final ScoreTrackerRoundRepository rounds;
    private final ScoreTrackerScoreRepository scores;
    private final ScoreDayRepository days;
    private final ScoreDayPlayerRepository dayPlayers;
    private final ScoreSessionPlayerRepository sessionPlayers;
    private final UserAccountRepository users;
    private final WebSocketService webSocketService;

    private UserAccount account(String email) {
        return users.findByGoogleEmail(email).orElseThrow(() -> BusinessException.forbidden("Usuario no encontrado"));
    }

    private Long userId(String email) {
        return account(email).getId();
    }

    /** Cómo se llama el usuario en el marcador: su nombre de jugador de la app, o el de su cuenta. */
    static String displayName(UserAccount account) {
        String name = clean(account.getParticipantName());
        if (name.isEmpty()) name = clean(account.getGoogleName());
        if (name.isEmpty()) name = "Jugador";
        return name.length() > MAX_NAME_LENGTH ? name.substring(0, MAX_NAME_LENGTH) : name;
    }

    /** El nombre tal cual si está libre; si no, con un número para que no se repitan. */
    static String freeName(String wanted, List<ScoreTrackerPlayer> existing) {
        Set<String> taken = existing.stream().map(player -> player.getName().toLowerCase(Locale.ROOT))
                .collect(Collectors.toSet());
        if (!taken.contains(wanted.toLowerCase(Locale.ROOT))) return wanted;
        for (int number = 2; ; number++) {
            String suffix = " (" + number + ")";
            String base = wanted.length() + suffix.length() > MAX_NAME_LENGTH
                    ? wanted.substring(0, MAX_NAME_LENGTH - suffix.length()) : wanted;
            String candidate = base + suffix;
            if (!taken.contains(candidate.toLowerCase(Locale.ROOT))) return candidate;
        }
    }

    /** La liga de marcador, si el usuario es miembro; si no existe o no es suya, el mismo error (no se filtra su existencia). */
    private League visible(Long userId, Long leagueId) {
        League league = leagues.findById(leagueId).filter(League::isScoreboard)
                .orElseThrow(() -> BusinessException.notFound("Marcador no encontrado"));
        if (!memberships.existsById(new Membership.MembershipId(userId, leagueId))) {
            throw BusinessException.notFound("Marcador no encontrado");
        }
        return league;
    }

    private static boolean administers(League league, Long userId) {
        return league.getAdminUserId() != null && league.getAdminUserId().equals(userId);
    }

    private League owned(Long userId, Long leagueId) {
        League league = visible(userId, leagueId);
        if (!administers(league, userId)) {
            throw BusinessException.forbidden("Solo quien creó el marcador puede cambiarlo");
        }
        return league;
    }

    private static String clean(String value) {
        return value == null ? "" : value.trim().replaceAll("\\s+", " ");
    }

    private String newCode() {
        for (int attempt = 0; attempt < 10; attempt++) {
            StringBuilder code = new StringBuilder();
            for (int i = 0; i < CODE_LENGTH; i++) code.append(CODE_ALPHABET.charAt(RANDOM.nextInt(CODE_ALPHABET.length())));
            if (leagues.findByJoinCode(code.toString()).isEmpty()) return code.toString();
        }
        throw BusinessException.conflict("No se pudo generar el código, inténtalo de nuevo");
    }

    private static String gameName(String wanted, String fallback) {
        String name = clean(wanted);
        if (name.isEmpty()) name = clean(fallback);
        return name.length() > 60 ? name.substring(0, 60) : name;
    }

    /**
     * Crea la liga con quien la crea como primer jugador y su primer juego. El resto entra al unirse con el
     * código o los añade el administrador a mano; los nombres que lleve la petición se suman detrás.
     */
    @Transactional
    @CacheEvict(value = "userGroups", key = "#email")
    public ScoreTrackerDTO create(String email, ScoreTrackerRequest request) {
        UserAccount owner = account(email);
        Long userId = owner.getId();
        long owned = leagues.findByAdminUserId(userId).stream().filter(League::isScoreboard).count();
        if (owned >= MAX_TRACKERS_PER_OWNER) {
            throw BusinessException.badRequest("Has llegado al máximo de marcadores");
        }
        String name = clean(request.name());
        if (name.isEmpty()) throw BusinessException.badRequest("Ponle nombre al marcador");
        String ownerName = displayName(owner);
        List<String> extra = request.players() == null ? List.of()
                : request.players().stream().map(ScoreTrackerService::clean).filter(n -> !n.isEmpty()).toList();
        List<String> names = new ArrayList<>();
        names.add(ownerName);
        names.addAll(extra);
        if (names.size() > MAX_PLAYERS) {
            throw BusinessException.badRequest("Máximo " + MAX_PLAYERS + " jugadores");
        }
        if (names.stream().map(n -> n.toLowerCase(Locale.ROOT)).distinct().count() != names.size()) {
            throw BusinessException.badRequest("Los nombres de los jugadores no pueden repetirse");
        }
        League league = leagues.save(League.builder().name(name).joinCode(newCode()).adminUser(owner)
                .kind(League.KIND_SCOREBOARD).build());
        memberships.save(Membership.builder().id(new Membership.MembershipId(userId, league.getId()))
                .user(owner).league(league).role("ADMIN").build());
        ScoreGame game = games.save(newGame(league.getId(), gameName(request.gameName(), name), request.unit(),
                request.lowerWins(), request.mode()));
        List<Long> playerIds = new ArrayList<>();
        for (int i = 0; i < names.size(); i++) {
            playerIds.add(players.save(ScoreTrackerPlayer.builder().leagueId(league.getId()).name(names.get(i))
                    .userId(i == 0 ? userId : null).position(i).build()).getId());
        }
        startSession(league.getId(), game.getId(), playerIds, null);
        return view(league, userId);
    }

    @Transactional(readOnly = true)
    public List<ScoreTrackerSummaryDTO> mine(String email) {
        Long userId = userId(email);
        Set<Long> ids = memberships.findByUserId(userId).stream().map(m -> m.getId().getLeagueId())
                .collect(Collectors.toCollection(HashSet::new));
        if (ids.isEmpty()) return List.of();
        List<League> own = leagues.findAllById(ids).stream().filter(League::isScoreboard)
                .sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt())).toList();
        if (own.isEmpty()) return List.of();
        Set<Long> scoreboardIds = own.stream().map(League::getId).collect(Collectors.toSet());
        Map<Long, Long> playerCounts = players.findByLeagueIdIn(scoreboardIds).stream()
                .collect(Collectors.groupingBy(ScoreTrackerPlayer::getLeagueId, Collectors.counting()));
        Map<Long, Long> roundCounts = rounds.findByLeagueIdIn(scoreboardIds).stream()
                .collect(Collectors.groupingBy(ScoreTrackerRound::getLeagueId, Collectors.counting()));
        return own.stream()
                .map(league -> new ScoreTrackerSummaryDTO(league.getId(), league.getName(),
                        administers(league, userId), playerCounts.getOrDefault(league.getId(), 0L).intValue(),
                        roundCounts.getOrDefault(league.getId(), 0L).intValue()))
                .toList();
    }

    @Transactional(readOnly = true)
    public ScoreTrackerDTO get(String email, Long leagueId) {
        Long userId = userId(email);
        return view(visible(userId, leagueId), userId);
    }

    /**
     * Entra a una liga de marcador con su código y aparece en ella como jugador: si el administrador ya había
     * apuntado a alguien con su mismo nombre se queda con ese, y si no se añade uno nuevo. Repetir la
     * petición no duplica nada.
     */
    @Transactional
    public ScoreTrackerDTO join(String email, String code) {
        UserAccount account = account(email);
        Long userId = account.getId();
        League league = leagues.findByJoinCode(clean(code).toUpperCase(Locale.ROOT)).filter(League::isScoreboard)
                .orElseThrow(() -> BusinessException.notFound("Código no válido"));
        boolean already = memberships.existsById(new Membership.MembershipId(userId, league.getId()))
                && players.findByLeagueIdAndUserId(league.getId(), userId).isPresent();
        if (already) return view(league, userId);
        membershipService.join(league.getId(), email);
        roster.memberJoined(league, account);
        return changed(league, userId);
    }

    /**
     * Apunta una ronda en una partida abierta. Sin partida, va a la última; si ya está terminada se
     * empieza otra del mismo juego (así sigue funcionando quien apunta sin elegir partida).
     */
    @Transactional
    public ScoreTrackerDTO addRound(String email, Long leagueId, ScoreTrackerRoundRequest request) {
        Long userId = userId(email);
        League league = visible(userId, leagueId);
        if (rounds.countByLeagueId(leagueId) >= MAX_ROUNDS) {
            throw BusinessException.badRequest("Esta liga ha llegado al máximo de rondas");
        }
        ScoreTrackerSession session;
        if (request.sessionId() != null) {
            session = sessionOf(leagueId, request.sessionId());
            if (!session.isOpen()) {
                throw BusinessException.conflict("La partida está terminada: reábrela para apuntar");
            }
        } else {
            currentDay(leagueId);
            ScoreTrackerSession last = sessions.findFirstByLeagueIdOrderByIdDesc(leagueId).orElse(null);
            session = last != null && last.isOpen() ? last
                    : startSession(leagueId, last != null ? last.getGameId() : firstGame(leagueId).getId(), null, null);
        }
        Map<Long, Integer> points = roundPoints(leagueId, session, request);
        String note = clean(request.note());
        ScoreTrackerRound round = rounds.save(ScoreTrackerRound.builder().leagueId(leagueId)
                .sessionId(session.getId()).note(note.isEmpty() ? null : note).createdByUserId(userId).build());
        points.forEach((playerId, value) -> scores.save(ScoreTrackerScore.builder().roundId(round.getId())
                .playerId(playerId).points(value).build()));
        return changed(league, userId);
    }

    /** Corrige una ronda: sustituye sus puntos (o quién la ganó) y su nota. */
    @Transactional
    public ScoreTrackerDTO editRound(String email, Long leagueId, Long roundId, ScoreTrackerRoundRequest request) {
        Long userId = userId(email);
        League league = visible(userId, leagueId);
        ScoreTrackerRound round = roundOf(leagueId, roundId);
        ScoreTrackerSession session = sessionOf(leagueId, round.getSessionId());
        requireEditable(league, userId, session);
        Map<Long, Integer> points = roundPoints(leagueId, session, request);
        for (ScoreTrackerScore score : scores.findByRoundIdIn(List.of(roundId))) {
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
        String note = clean(request.note());
        round.setNote(note.isEmpty() ? null : note);
        rounds.save(round);
        return changed(league, userId);
    }

    /** Cualquier miembro borra rondas de una partida abierta; en una terminada, solo el administrador. */
    @Transactional
    public ScoreTrackerDTO deleteRound(String email, Long leagueId, Long roundId) {
        Long userId = userId(email);
        League league = visible(userId, leagueId);
        ScoreTrackerRound round = roundOf(leagueId, roundId);
        requireEditable(league, userId, sessionOf(leagueId, round.getSessionId()));
        rounds.delete(round);
        return changed(league, userId);
    }

    private void requireEditable(League league, Long userId, ScoreTrackerSession session) {
        if (!session.isOpen() && !administers(league, userId)) {
            throw BusinessException.conflict("La partida está terminada: reábrela para corregirla");
        }
    }

    /**
     * Puntos que guarda una ronda, solo de quienes la jugaron. En los juegos por puntos, los que vienen en la
     * petición; en los de victorias, 1 a quien ganó y 0 al resto de participantes. Quien apunta puntos sin
     * ser participante pasa a serlo.
     */
    private Map<Long, Integer> roundPoints(Long leagueId, ScoreTrackerSession session,
                                           ScoreTrackerRoundRequest request) {
        Set<Long> leaguePlayers = playerIds(leagueId);
        ScoreGame game = gameOf(leagueId, session.getGameId());
        Map<Long, Integer> given = request.scores() == null ? Map.of() : request.scores();
        for (Map.Entry<Long, Integer> entry : given.entrySet()) {
            if (!leaguePlayers.contains(entry.getKey()) || entry.getValue() == null) {
                throw BusinessException.badRequest("Jugador no válido");
            }
            if (Math.abs((long) entry.getValue()) > MAX_POINTS) {
                throw BusinessException.badRequest("Los puntos tienen que estar entre -" + MAX_POINTS + " y " + MAX_POINTS);
            }
        }
        Set<Long> participants = participantIds(session.getId());
        Map<Long, Integer> points = new LinkedHashMap<>();
        if (game.isWins()) {
            Set<Long> winners = new LinkedHashSet<>(request.winners() != null && !request.winners().isEmpty()
                    ? request.winners()
                    : given.entrySet().stream().filter(entry -> entry.getValue() > 0).map(Map.Entry::getKey).toList());
            if (winners.isEmpty()) throw BusinessException.badRequest("Marca quién ha ganado la ronda");
            if (!leaguePlayers.containsAll(winners)) throw BusinessException.badRequest("Jugador no válido");
            addParticipants(session.getId(), participants, winners);
            participants.forEach(id -> points.put(id, winners.contains(id) ? 1 : 0));
        } else {
            if (given.isEmpty()) throw BusinessException.badRequest("Apunta los puntos de al menos un jugador");
            addParticipants(session.getId(), participants, given.keySet());
            points.putAll(given);
        }
        return points;
    }

    private void addParticipants(Long sessionId, Set<Long> participants, Collection<Long> wanted) {
        for (Long id : wanted) {
            if (participants.add(id)) sessionPlayers.save(new ScoreSessionPlayer(sessionId, id));
        }
    }

    private Set<Long> participantIds(Long sessionId) {
        return sessionPlayers.findBySessionId(sessionId).stream().map(ScoreSessionPlayer::getPlayerId)
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private Set<Long> playerIds(Long leagueId) {
        return players.findByLeagueIdOrderByPositionAsc(leagueId).stream().map(ScoreTrackerPlayer::getId)
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    /** Jugadores pedidos, comprobando que son de la liga; al menos uno. */
    private List<Long> chosenPlayers(Long leagueId, List<Long> wanted) {
        List<Long> ids = wanted == null ? List.of() : wanted.stream().filter(Objects::nonNull).distinct().toList();
        if (ids.isEmpty()) throw BusinessException.badRequest("Elige al menos un jugador");
        if (!playerIds(leagueId).containsAll(ids)) throw BusinessException.badRequest("Jugador no válido");
        return ids;
    }

    private ScoreTrackerRound roundOf(Long leagueId, Long roundId) {
        return rounds.findById(roundId).filter(found -> found.getLeagueId().equals(leagueId))
                .orElseThrow(() -> BusinessException.notFound("Ronda no encontrada"));
    }

    private ScoreTrackerSession sessionOf(Long leagueId, Long sessionId) {
        return sessions.findById(sessionId).filter(found -> found.getLeagueId().equals(leagueId))
                .orElseThrow(() -> BusinessException.notFound("Partida no encontrada"));
    }

    private ScoreDay dayOf(Long leagueId, Long dayId) {
        return days.findById(dayId).filter(found -> found.getLeagueId().equals(leagueId))
                .orElseThrow(() -> BusinessException.notFound("Día de juego no encontrado"));
    }

    private ScoreGame firstGame(Long leagueId) {
        return games.findByLeagueIdOrderByIdAsc(leagueId).stream().findFirst()
                .orElseThrow(() -> BusinessException.badRequest("La liga no tiene ningún juego"));
    }

    private ScoreGame gameOf(Long leagueId, Long gameId) {
        return games.findById(gameId).filter(game -> game.getLeagueId().equals(leagueId))
                .orElseThrow(() -> BusinessException.badRequest("Juego no válido"));
    }

    // ---- Días de juego ----

    /**
     * El día de juego en curso. Uno sin actividad desde hace más de {@link #STALE_DAY} se da por terminado
     * (alguien se olvidó de cerrarlo) y entonces no hay día en curso.
     */
    private ScoreDay currentDay(Long leagueId) {
        ScoreDay day = days.findFirstByLeagueIdAndClosedAtIsNullOrderByIdDesc(leagueId).orElse(null);
        if (day == null) return null;
        List<ScoreTrackerSession> leagueSessions = sessions.findByLeagueIdOrderByIdAsc(leagueId);
        List<ScoreTrackerRound> leagueRounds = rounds.findByLeagueIdOrderByIdAsc(leagueId);
        Instant last = lastActivity(day, leagueSessions, leagueRounds);
        if (last.isAfter(Instant.now().minus(STALE_DAY))) return day;
        finishDay(day, last, leagueSessions, leagueRounds);
        return null;
    }

    static Instant lastActivity(ScoreDay day, List<ScoreTrackerSession> leagueSessions,
                                List<ScoreTrackerRound> leagueRounds) {
        Set<Long> own = leagueSessions.stream().filter(session -> session.getDayId().equals(day.getId()))
                .map(ScoreTrackerSession::getId).collect(Collectors.toSet());
        Instant last = day.getStartedAt();
        for (ScoreTrackerSession session : leagueSessions) {
            if (own.contains(session.getId()) && session.getStartedAt().isAfter(last)) last = session.getStartedAt();
        }
        for (ScoreTrackerRound round : leagueRounds) {
            if (own.contains(round.getSessionId()) && round.getCreatedAt().isAfter(last)) last = round.getCreatedAt();
        }
        return last;
    }

    /**
     * Cierra el día: termina sus partidas abiertas y quita las que no tienen ninguna ronda. Un día que se
     * queda sin partidas no se guarda en el histórico.
     */
    private void finishDay(ScoreDay day, Instant at, List<ScoreTrackerSession> leagueSessions,
                           List<ScoreTrackerRound> leagueRounds) {
        Set<Long> withRounds = leagueRounds.stream().map(ScoreTrackerRound::getSessionId).collect(Collectors.toSet());
        boolean kept = false;
        for (ScoreTrackerSession session : leagueSessions) {
            if (!session.getDayId().equals(day.getId())) continue;
            if (!withRounds.contains(session.getId())) {
                sessions.delete(session);
                continue;
            }
            kept = true;
            if (session.isOpen()) {
                session.setEndedAt(at);
                sessions.save(session);
            }
        }
        if (kept) {
            day.setClosedAt(at);
            days.save(day);
        } else {
            days.delete(day);
        }
        sessions.flush();
    }

    private ScoreDay newDay(Long leagueId, Collection<Long> attendees) {
        ScoreDay day = days.save(ScoreDay.builder().leagueId(leagueId).build());
        attendees.forEach(id -> dayPlayers.save(new ScoreDayPlayer(day.getId(), id)));
        return day;
    }

    /** Empieza el día de juego con quienes han venido (sin lista, todos). Si ya hay uno en curso, lo actualiza. */
    @Transactional
    public ScoreTrackerDTO startDay(String email, Long leagueId, List<Long> playerIds) {
        Long userId = userId(email);
        League league = visible(userId, leagueId);
        boolean chosen = playerIds != null && !playerIds.isEmpty();
        List<Long> attendees = chosen ? chosenPlayers(leagueId, playerIds) : List.copyOf(playerIds(leagueId));
        ScoreDay day = currentDay(leagueId);
        if (day == null) {
            newDay(leagueId, attendees);
        } else if (chosen) {
            replaceDayPlayers(day.getId(), attendees);
        }
        return changed(league, userId);
    }

    @Transactional
    public ScoreTrackerDTO setDayPlayers(String email, Long leagueId, Long dayId, List<Long> playerIds) {
        Long userId = userId(email);
        League league = visible(userId, leagueId);
        dayOf(leagueId, dayId);
        replaceDayPlayers(dayId, chosenPlayers(leagueId, playerIds));
        return changed(league, userId);
    }

    private void replaceDayPlayers(Long dayId, List<Long> wanted) {
        Set<Long> keep = new HashSet<>(wanted);
        Set<Long> present = new HashSet<>();
        for (ScoreDayPlayer row : dayPlayers.findByDayId(dayId)) {
            if (keep.contains(row.getPlayerId())) present.add(row.getPlayerId());
            else dayPlayers.delete(row);
        }
        wanted.stream().filter(id -> !present.contains(id))
                .forEach(id -> dayPlayers.save(new ScoreDayPlayer(dayId, id)));
    }

    @Transactional
    public ScoreTrackerDTO closeDay(String email, Long leagueId, Long dayId) {
        Long userId = userId(email);
        League league = visible(userId, leagueId);
        ScoreDay day = dayOf(leagueId, dayId);
        if (day.isOpen()) {
            finishDay(day, Instant.now(), sessions.findByLeagueIdOrderByIdAsc(leagueId),
                    rounds.findByLeagueIdOrderByIdAsc(leagueId));
        }
        return changed(league, userId);
    }

    // ---- Partidas ----

    /**
     * Empieza una partida en el día en curso (si no hay, empieza uno con todos). Sin juego, sigue con el de
     * la partida anterior; sin jugadores, juegan los asistentes del día. Si la última partida sigue abierta y
     * vacía no hace falta otra: se cambia; si tiene rondas, se termina.
     */
    @Transactional
    public ScoreTrackerDTO newSession(String email, Long leagueId, Long gameId, List<Long> playerIds,
                                      Integer plannedRounds) {
        Long userId = userId(email);
        League league = visible(userId, leagueId);
        ScoreDay day = currentDay(leagueId);
        ScoreTrackerSession last = sessions.findFirstByLeagueIdOrderByIdDesc(leagueId).orElse(null);
        Long game = gameId != null ? gameOf(leagueId, gameId).getId()
                : last != null ? last.getGameId() : firstGame(leagueId).getId();
        List<Long> chosen = playerIds == null || playerIds.isEmpty() ? null : chosenPlayers(leagueId, playerIds);
        boolean reuse = day != null && last != null && last.isOpen() && last.getDayId().equals(day.getId())
                && rounds.findByLeagueIdOrderByIdAsc(leagueId).stream()
                .noneMatch(round -> round.getSessionId().equals(last.getId()));
        if (reuse) {
            last.setGameId(game);
            last.setPlannedRounds(plannedRounds);
            sessions.save(last);
            if (chosen != null) {
                replaceParticipants(last.getId(), chosen);
                addDayPlayers(day.getId(), chosen);
            }
        } else {
            for (ScoreTrackerSession open : sessions.findByLeagueIdOrderByIdAsc(leagueId)) {
                if (open.isOpen()) {
                    open.setEndedAt(Instant.now());
                    sessions.save(open);
                }
            }
            startSession(leagueId, game, chosen, plannedRounds);
        }
        return changed(league, userId);
    }

    /** Crea la partida en el día en curso, o en uno nuevo si no lo hay. */
    private ScoreTrackerSession startSession(Long leagueId, Long gameId, List<Long> chosen, Integer plannedRounds) {
        ScoreDay day = currentDay(leagueId);
        if (day == null) day = newDay(leagueId, chosen != null ? chosen : playerIds(leagueId));
        List<Long> participants = chosen;
        if (participants == null) {
            participants = dayPlayers.findByDayId(day.getId()).stream().map(ScoreDayPlayer::getPlayerId).toList();
            if (participants.isEmpty()) participants = List.copyOf(playerIds(leagueId));
        } else {
            addDayPlayers(day.getId(), participants);
        }
        ScoreTrackerSession session = sessions.save(ScoreTrackerSession.builder().leagueId(leagueId)
                .gameId(gameId).dayId(day.getId()).plannedRounds(plannedRounds).build());
        participants.forEach(id -> sessionPlayers.save(new ScoreSessionPlayer(session.getId(), id)));
        return session;
    }

    private void addDayPlayers(Long dayId, Collection<Long> wanted) {
        Set<Long> present = dayPlayers.findByDayId(dayId).stream().map(ScoreDayPlayer::getPlayerId)
                .collect(Collectors.toSet());
        wanted.stream().filter(id -> !present.contains(id))
                .forEach(id -> dayPlayers.save(new ScoreDayPlayer(dayId, id)));
    }

    private void replaceParticipants(Long sessionId, List<Long> wanted) {
        Set<Long> keep = new HashSet<>(wanted);
        Set<Long> present = new HashSet<>();
        for (ScoreSessionPlayer row : sessionPlayers.findBySessionId(sessionId)) {
            if (keep.contains(row.getPlayerId())) present.add(row.getPlayerId());
            else sessionPlayers.delete(row);
        }
        wanted.stream().filter(id -> !present.contains(id))
                .forEach(id -> sessionPlayers.save(new ScoreSessionPlayer(sessionId, id)));
    }

    /** Cambia quién juega una partida; no se puede quitar a quien ya tiene puntos apuntados en ella. */
    @Transactional
    public ScoreTrackerDTO setSessionPlayers(String email, Long leagueId, Long sessionId, List<Long> playerIds) {
        Long userId = userId(email);
        League league = visible(userId, leagueId);
        ScoreTrackerSession session = sessionOf(leagueId, sessionId);
        requireEditable(league, userId, session);
        List<Long> chosen = chosenPlayers(leagueId, playerIds);
        List<Long> roundIds = rounds.findByLeagueIdOrderByIdAsc(leagueId).stream()
                .filter(round -> round.getSessionId().equals(sessionId)).map(ScoreTrackerRound::getId).toList();
        if (!roundIds.isEmpty() && scores.findByRoundIdIn(roundIds).stream()
                .anyMatch(score -> !chosen.contains(score.getPlayerId()))) {
            throw BusinessException.conflict("No se puede quitar a quien ya tiene rondas apuntadas en la partida");
        }
        replaceParticipants(sessionId, chosen);
        addDayPlayers(session.getDayId(), chosen);
        return changed(league, userId);
    }

    @Transactional
    public ScoreTrackerDTO endSession(String email, Long leagueId, Long sessionId) {
        Long userId = userId(email);
        League league = visible(userId, leagueId);
        ScoreTrackerSession session = sessionOf(leagueId, sessionId);
        if (session.isOpen()) {
            session.setEndedAt(Instant.now());
            sessions.save(session);
        }
        return changed(league, userId);
    }

    /** Reabre una partida terminada para corregirla o seguir apuntando. */
    @Transactional
    public ScoreTrackerDTO reopenSession(String email, Long leagueId, Long sessionId) {
        Long userId = userId(email);
        League league = visible(userId, leagueId);
        ScoreTrackerSession session = sessionOf(leagueId, sessionId);
        if (!session.isOpen()) {
            session.setEndedAt(null);
            sessions.save(session);
        }
        return changed(league, userId);
    }

    /** Añade un juego a la liga (otro al que se juega algún día). */
    @Transactional
    public ScoreTrackerDTO addGame(String email, Long leagueId, ScoreGameRequest request) {
        Long userId = userId(email);
        League league = visible(userId, leagueId);
        String name = gameName(request.name(), "");
        if (name.isEmpty()) throw BusinessException.badRequest("Ponle nombre al juego");
        List<ScoreGame> existing = games.findByLeagueIdOrderByIdAsc(leagueId);
        if (existing.size() >= MAX_GAMES) throw BusinessException.badRequest("Máximo " + MAX_GAMES + " juegos");
        requireFreeGameName(existing, name, null);
        games.save(newGame(leagueId, name, request.unit(), request.lowerWins(), request.mode()));
        return changed(league, userId);
    }

    /** En los juegos por victorias no hay «gana quien menos» y la unidad por defecto son las victorias. */
    private static ScoreGame newGame(Long leagueId, String name, String unit, boolean lowerWins, String mode) {
        boolean wins = ScoreGame.MODE_WINS.equals(mode);
        String cleanUnit = clean(unit);
        return ScoreGame.builder().leagueId(leagueId).name(name)
                .unit(cleanUnit.isEmpty() ? (wins ? "victorias" : "puntos") : cleanUnit)
                .lowerWins(!wins && lowerWins).mode(wins ? ScoreGame.MODE_WINS : ScoreGame.MODE_POINTS).build();
    }

    @Transactional
    public ScoreTrackerDTO renameGame(String email, Long leagueId, Long gameId, ScoreGameNameRequest request) {
        Long userId = userId(email);
        League league = owned(userId, leagueId);
        ScoreGame game = gameOf(leagueId, gameId);
        String name = gameName(request.name(), "");
        if (name.isEmpty()) throw BusinessException.badRequest("Ponle nombre al juego");
        requireFreeGameName(games.findByLeagueIdOrderByIdAsc(leagueId), name, gameId);
        game.setName(name);
        games.save(game);
        return changed(league, userId);
    }

    /** Un juego solo se borra si no tiene partidas apuntadas y no es el único de la liga. */
    @Transactional
    public ScoreTrackerDTO deleteGame(String email, Long leagueId, Long gameId) {
        Long userId = userId(email);
        League league = owned(userId, leagueId);
        ScoreGame game = gameOf(leagueId, gameId);
        if (games.countByLeagueId(leagueId) <= 1) {
            throw BusinessException.badRequest("La liga necesita al menos un juego");
        }
        Set<Long> gameSessions = sessions.findByLeagueIdOrderByIdAsc(leagueId).stream()
                .filter(session -> session.getGameId().equals(gameId)).map(ScoreTrackerSession::getId)
                .collect(Collectors.toSet());
        if (rounds.findByLeagueIdOrderByIdAsc(leagueId).stream()
                .anyMatch(round -> gameSessions.contains(round.getSessionId()))) {
            throw BusinessException.conflict("Ese juego ya tiene partidas: no se puede borrar");
        }
        Set<Long> touchedDays = sessions.findAllById(gameSessions).stream().map(ScoreTrackerSession::getDayId)
                .collect(Collectors.toSet());
        sessions.deleteAllById(gameSessions);
        sessions.flush();
        Set<Long> usedDays = sessions.findByLeagueIdOrderByIdAsc(leagueId).stream()
                .map(ScoreTrackerSession::getDayId).collect(Collectors.toSet());
        days.findAllById(touchedDays).stream().filter(day -> !day.isOpen() && !usedDays.contains(day.getId()))
                .forEach(days::delete);
        games.delete(game);
        return changed(league, userId);
    }

    private static void requireFreeGameName(List<ScoreGame> existing, String name, Long exceptId) {
        if (existing.stream().anyMatch(game -> !game.getId().equals(exceptId) && game.getName().equalsIgnoreCase(name))) {
            throw BusinessException.badRequest("Ya hay un juego con ese nombre");
        }
    }

    @Transactional
    public ScoreTrackerDTO addPlayer(String email, Long leagueId, String name) {
        Long userId = userId(email);
        League league = visible(userId, leagueId);
        String clean = clean(name);
        if (clean.isEmpty()) throw BusinessException.badRequest("Escribe el nombre del jugador");
        List<ScoreTrackerPlayer> all = players.findByLeagueIdOrderByPositionAsc(leagueId);
        if (all.size() >= MAX_PLAYERS) throw BusinessException.badRequest("Máximo " + MAX_PLAYERS + " jugadores");
        if (all.stream().anyMatch(player -> player.getName().equalsIgnoreCase(clean))) {
            throw BusinessException.badRequest("Ya hay un jugador con ese nombre");
        }
        players.save(ScoreTrackerPlayer.builder().leagueId(leagueId).name(clean).position(all.size()).build());
        return changed(league, userId);
    }

    /**
     * El usuario dice cuál de los jugadores es él, para que en cada móvil se vea quién es quién. Solo uno
     * por liga (cambiar de jugador libera el anterior) y nadie puede quitarle el suyo a otro.
     */
    @Transactional
    public ScoreTrackerDTO claimPlayer(String email, Long leagueId, Long playerId) {
        Long userId = userId(email);
        League league = visible(userId, leagueId);
        ScoreTrackerPlayer target = players.findById(playerId)
                .filter(found -> found.getLeagueId().equals(leagueId))
                .orElseThrow(() -> BusinessException.badRequest("Jugador no válido"));
        if (target.getUserId() != null && !target.getUserId().equals(userId)) {
            throw BusinessException.conflict("Ese jugador ya es de otra persona");
        }
        if (userId.equals(target.getUserId())) return view(league, userId);
        players.findByLeagueIdAndUserId(leagueId, userId).ifPresent(previous -> {
            previous.setUserId(null);
            players.saveAndFlush(previous);
        });
        target.setUserId(userId);
        players.save(target);
        return changed(league, userId);
    }

    @Transactional
    public ScoreTrackerDTO releasePlayer(String email, Long leagueId) {
        Long userId = userId(email);
        League league = visible(userId, leagueId);
        roster.memberLeft(leagueId, userId);
        return changed(league, userId);
    }

    /** Borra la liga entera (solo su administrador). */
    @Transactional
    public void delete(String email, Long leagueId) {
        Long userId = userId(email);
        League league = owned(userId, leagueId);
        Set<Long> audience = audience(league);
        leagueService.deleteLeague(leagueId, email);
        notifyAfterCommit(leagueId, audience);
    }

    /** Quien no es el administrador deja de ver la liga; el administrador la borra. */
    @Transactional
    public void leave(String email, Long leagueId) {
        Long userId = userId(email);
        League league = visible(userId, leagueId);
        if (administers(league, userId)) {
            throw BusinessException.badRequest("Eres quien lo creó: bórralo si ya no lo quieres");
        }
        Set<Long> audience = audience(league);
        membershipService.leave(leagueId, email);
        notifyAfterCommit(leagueId, audience);
    }

    private ScoreTrackerDTO changed(League league, Long userId) {
        notifyAfterCommit(league.getId(), audience(league));
        return view(league, userId);
    }

    private Set<Long> audience(League league) {
        Set<Long> audience = memberships.findByLeagueId(league.getId()).stream()
                .map(membership -> membership.getId().getUserId()).collect(Collectors.toCollection(HashSet::new));
        if (league.getAdminUserId() != null) audience.add(league.getAdminUserId());
        return audience;
    }

    /** El aviso sale cuando los datos ya están guardados: si no, el cliente recargaría lo de antes. */
    private void notifyAfterCommit(Long leagueId, Set<Long> audience) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            webSocketService.notifyTrackerChanged(leagueId, audience);
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                webSocketService.notifyTrackerChanged(leagueId, audience);
            }
        });
    }

    private ScoreTrackerDTO view(League league, Long userId) {
        Long leagueId = league.getId();
        List<ScoreTrackerPlayer> playerRows = players.findByLeagueIdOrderByPositionAsc(leagueId);
        List<Player> playerList = playerRows.stream()
                .map(player -> new Player(player.getId(), player.getName())).toList();
        Map<Long, String> nameByUser = new HashMap<>();
        playerRows.stream().filter(player -> player.getUserId() != null)
                .forEach(player -> nameByUser.put(player.getUserId(), player.getName()));
        Long myPlayerId = playerRows.stream().filter(player -> userId.equals(player.getUserId()))
                .map(ScoreTrackerPlayer::getId).findFirst().orElse(null);
        List<Long> claimed = playerRows.stream().filter(player -> player.getUserId() != null)
                .map(ScoreTrackerPlayer::getId).toList();
        List<ScoreGame> gameRows = games.findByLeagueIdOrderByIdAsc(leagueId);
        Map<Long, ScoreGame> gameById = gameRows.stream()
                .collect(Collectors.toMap(ScoreGame::getId, game -> game, (a, b) -> a, LinkedHashMap::new));
        List<ScoreTrackerSession> sessionList = sessions.findByLeagueIdOrderByIdAsc(leagueId);
        List<ScoreTrackerRound> roundList = rounds.findByLeagueIdOrderByIdAsc(leagueId);
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
        Map<Long, Set<Long>> participantsBySession = new HashMap<>();
        List<Long> sessionIds = sessionList.stream().map(ScoreTrackerSession::getId).toList();
        if (!sessionIds.isEmpty()) {
            for (ScoreSessionPlayer row : sessionPlayers.findBySessionIdIn(sessionIds)) {
                participantsBySession.computeIfAbsent(row.getSessionId(), key -> new HashSet<>())
                        .add(row.getPlayerId());
            }
        }

        List<Session> sessionViews = new ArrayList<>();
        Map<Long, Map<Long, Integer>> totalsByGame = new HashMap<>();
        Map<Long, Map<Long, Integer>> roundsWonByGame = new HashMap<>();
        Map<Long, Map<Long, Integer>> wonByGame = new HashMap<>();
        Map<Long, Map<Long, Integer>> playedByGame = new HashMap<>();
        Map<Long, Integer> roundCountByGame = new HashMap<>();
        Map<Long, Integer> sessionCountByGame = new HashMap<>();
        int number = 1;
        for (ScoreTrackerSession session : sessionList) {
            ScoreGame game = gameById.get(session.getGameId());
            List<ScoreTrackerRound> own = roundsBySession.getOrDefault(session.getId(), List.of());
            List<Map<Long, Integer>> ownPoints = own.stream()
                    .map(round -> pointsByRound.getOrDefault(round.getId(), Map.<Long, Integer>of())).toList();
            Set<Long> scored = new HashSet<>();
            ownPoints.forEach(points -> scored.addAll(points.keySet()));
            Set<Long> participants = new HashSet<>(participantsBySession.getOrDefault(session.getId(), Set.of()));
            participants.addAll(scored);
            List<Player> sessionPlayerList = playerList.stream()
                    .filter(player -> participants.contains(player.id())).toList();
            boolean lowerWins = game != null && !game.isWins() && game.isLowerWins();
            List<Standing> standings = ScoreTrackerStandings.rank(sessionPlayerList, lowerWins, ownPoints);
            List<Long> winners = ScoreTrackerStandings.leaders(standings, own.size());
            Long gameKey = session.getGameId();
            Map<Long, Integer> totals = totalsByGame.computeIfAbsent(gameKey, key -> new HashMap<>());
            Map<Long, Integer> roundsWon = roundsWonByGame.computeIfAbsent(gameKey, key -> new HashMap<>());
            Map<Long, Integer> won = wonByGame.computeIfAbsent(gameKey, key -> new HashMap<>());
            Map<Long, Integer> played = playedByGame.computeIfAbsent(gameKey, key -> new HashMap<>());
            for (Standing standing : standings) {
                if (!scored.contains(standing.playerId())) continue;
                totals.merge(standing.playerId(), standing.total(), Integer::sum);
                roundsWon.merge(standing.playerId(), standing.roundsWon(), Integer::sum);
                if (!session.isOpen()) played.merge(standing.playerId(), 1, Integer::sum);
            }
            if (!session.isOpen()) winners.forEach(id -> won.merge(id, 1, Integer::sum));
            roundCountByGame.merge(gameKey, own.size(), Integer::sum);
            sessionCountByGame.merge(gameKey, 1, Integer::sum);
            sessionViews.add(new Session(session.getId(), number++, gameKey, session.getStartedAt().toString(),
                    own.size(), standings, winners, session.getDayId(),
                    playerList.stream().map(Player::id).filter(participants::contains).toList(),
                    session.getEndedAt() == null ? null : session.getEndedAt().toString(),
                    session.getPlannedRounds()));
        }
        int roundNumber = 1;
        List<Round> roundViews = new ArrayList<>();
        for (ScoreTrackerRound round : roundList) {
            roundViews.add(new Round(round.getId(), round.getSessionId(), roundNumber++, round.getNote(),
                    round.getCreatedAt().toString(), pointsByRound.getOrDefault(round.getId(), Map.of()),
                    round.getCreatedByUserId() == null ? null : nameByUser.get(round.getCreatedByUserId())));
        }

        List<Game> gameViews = new ArrayList<>();
        List<GameStandings> byGame = new ArrayList<>();
        Map<Long, Integer> totals = new HashMap<>();
        Map<Long, Integer> roundsWon = new HashMap<>();
        Map<Long, Integer> sessionsWon = new HashMap<>();
        Map<Long, Integer> sessionsPlayed = new HashMap<>();
        for (ScoreGame game : gameRows) {
            Map<Long, Integer> gameTotals = totalsByGame.getOrDefault(game.getId(), Map.of());
            Map<Long, Integer> gameRoundsWon = roundsWonByGame.getOrDefault(game.getId(), Map.of());
            Map<Long, Integer> gameWon = wonByGame.getOrDefault(game.getId(), Map.of());
            Map<Long, Integer> gamePlayed = playedByGame.getOrDefault(game.getId(), Map.of());
            List<Player> gamePlayers = playerList.stream()
                    .filter(player -> gameTotals.containsKey(player.id())).toList();
            byGame.add(new GameStandings(game.getId(),
                    ScoreTrackerStandings.general(gamePlayers, gameTotals, gameRoundsWon, gameWon, gamePlayed)));
            gameTotals.forEach((id, value) -> totals.merge(id, value, Integer::sum));
            gameRoundsWon.forEach((id, value) -> roundsWon.merge(id, value, Integer::sum));
            gameWon.forEach((id, value) -> sessionsWon.merge(id, value, Integer::sum));
            gamePlayed.forEach((id, value) -> sessionsPlayed.merge(id, value, Integer::sum));
            gameViews.add(new Game(game.getId(), game.getName(), game.getUnit(), game.isLowerWins(),
                    sessionCountByGame.getOrDefault(game.getId(), 0),
                    roundCountByGame.getOrDefault(game.getId(), 0), game.getMode()));
        }
        List<Standing> overall = ScoreTrackerStandings.general(playerList, totals, roundsWon, sessionsWon,
                sessionsPlayed);

        List<ScoreDay> dayRows = days.findByLeagueIdOrderByIdAsc(leagueId);
        Map<Long, Set<Long>> attendeesByDay = new HashMap<>();
        if (!dayRows.isEmpty()) {
            for (ScoreDayPlayer row : dayPlayers.findByDayIdIn(dayRows.stream().map(ScoreDay::getId).toList())) {
                attendeesByDay.computeIfAbsent(row.getDayId(), key -> new HashSet<>()).add(row.getPlayerId());
            }
        }
        List<Day> dayViews = new ArrayList<>();
        Long currentDayId = null;
        Instant freshSince = Instant.now().minus(STALE_DAY);
        for (ScoreDay day : dayRows) {
            Set<Long> attendees = attendeesByDay.getOrDefault(day.getId(), Set.of());
            dayViews.add(new Day(day.getId(), day.getStartedAt().toString(),
                    day.getClosedAt() == null ? null : day.getClosedAt().toString(),
                    playerList.stream().map(Player::id).filter(attendees::contains).toList(),
                    sessionList.stream().filter(session -> session.getDayId().equals(day.getId()))
                            .map(ScoreTrackerSession::getId).toList()));
            if (day.isOpen() && lastActivity(day, sessionList, roundList).isAfter(freshSince)) {
                currentDayId = day.getId();
            }
        }

        ScoreTrackerSession currentSession = sessionList.isEmpty() ? null : sessionList.get(sessionList.size() - 1);
        ScoreGame current = currentSession != null ? gameById.get(currentSession.getGameId())
                : gameRows.isEmpty() ? null : gameRows.get(0);
        return new ScoreTrackerDTO(leagueId, league.getName(), current == null ? "puntos" : current.getUnit(),
                current != null && current.isLowerWins(), administers(league, userId), league.getJoinCode(),
                myPlayerId, claimed, currentSession == null ? null : currentSession.getId(),
                current == null ? null : current.getId(), gameViews, playerList, sessionViews, roundViews,
                overall, byGame, currentDayId, dayViews);
    }
}
