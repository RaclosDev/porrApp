package app.porrapp.service.league;

import app.porrapp.util.AfterCommit;
import app.porrapp.dto.ScoreGameNameRequest;
import app.porrapp.dto.ScoreGameRequest;
import app.porrapp.dto.ScoreTrackerDTO;
import app.porrapp.dto.ScoreTrackerRequest;
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
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
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
    private final ApplicationEventPublisher events;
    private final ScoreTrackerLookup lookup;
    private final ScoreTrackerViewBuilder viewBuilder;

    private UserAccount account(String email) {
        return users.findByGoogleEmail(email).orElseThrow(() -> BusinessException.forbidden("Usuario no encontrado"));
    }

    public Long userId(String email) {
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
    public League visible(Long userId, Long leagueId) {
        League league = leagues.findById(leagueId).filter(League::isScoreboard)
                .orElseThrow(() -> BusinessException.notFound("Marcador no encontrado"));
        if (!memberships.existsById(new Membership.MembershipId(userId, leagueId))) {
            throw BusinessException.notFound("Marcador no encontrado");
        }
        return league;
    }

    static boolean administers(League league, Long userId) {
        return league.isAdmin(userId);
    }

    /** Una partida terminada solo la corrige el administrador. */
    static void requireEditable(League league, Long userId, ScoreTrackerSession session) {
        if (!session.isOpen() && !administers(league, userId)) {
            throw BusinessException.conflict("La partida está terminada: reábrela para corregirla");
        }
    }

    public League owned(Long userId, Long leagueId) {
        League league = visible(userId, leagueId);
        if (!administers(league, userId)) {
            throw BusinessException.forbidden("Solo quien creó el marcador puede cambiarlo");
        }
        return league;
    }

    static String clean(String value) {
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
     * Crea la liga con quien la crea como primer jugador. El juego se elige al jugar. El resto entra al unirse con el
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
        List<Long> playerIds = new ArrayList<>();
        for (int i = 0; i < names.size(); i++) {
            playerIds.add(players.save(ScoreTrackerPlayer.builder().leagueId(league.getId()).name(names.get(i))
                    .userId(i == 0 ? userId : null).position(i).build()).getId());
        }
        // Compatibilidad con clientes anteriores que creaban también el primer juego.
        if (!clean(request.gameName()).isEmpty() || !clean(request.unit()).isEmpty() || request.mode() != null) {
            ScoreGame game = games.save(newGame(league.getId(), gameName(request.gameName(), name), request.unit(),
                    request.lowerWins(), request.mode()));
            startSession(league.getId(), game.getId(), playerIds, null, userId);
        }
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
     * apuntado a alguien con su mismo nombre se crea un jugador distinto. Repetir la
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

    /** Partida en la que cae una ronda apuntada sin elegirla: la última si sigue abierta; si no, otra del mismo juego. */
    public ScoreTrackerSession sessionForRound(Long leagueId, Long userId) {
        currentDay(leagueId);
        ScoreTrackerSession last = sessions.findFirstByLeagueIdOrderByIdDesc(leagueId).orElse(null);
        return last != null && last.isOpen() ? last
                : startSession(leagueId, last != null ? last.getGameId() : lookup.firstGame(leagueId).getId(), null, null, userId);
    }

    // ---- Días de juego ----

    /** El día de juego sigue abierto hasta que alguien lo termine expresamente. */
    private ScoreDay currentDay(Long leagueId) {
        return days.findFirstByLeagueIdAndClosedAtIsNullOrderByIdDesc(leagueId).orElse(null);
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

    private ScoreDay newDay(Long leagueId, Collection<Long> attendees, Long userId) {
        ScoreDay day = days.save(ScoreDay.builder().leagueId(leagueId).build());
        events.publishEvent(new ScoreDayStartedEvent(leagueId, userId));
        attendees.forEach(id -> dayPlayers.save(new ScoreDayPlayer(day.getId(), id)));
        return day;
    }

    /** Empieza el día de juego con quienes han venido (sin lista, todos). Si ya hay uno en curso, lo actualiza. */
    @Transactional
    public ScoreTrackerDTO startDay(String email, Long leagueId, List<Long> playerIds) {
        Long userId = userId(email);
        League league = visible(userId, leagueId);
        boolean chosen = playerIds != null && !playerIds.isEmpty();
        List<Long> attendees = chosen ? lookup.chosenPlayers(leagueId, playerIds) : List.copyOf(lookup.playerIds(leagueId));
        ScoreDay day = currentDay(leagueId);
        if (day == null) {
            newDay(leagueId, attendees, userId);
        } else if (chosen) {
            replaceDayPlayers(day.getId(), attendees);
        }
        return changed(league, userId);
    }

    @Transactional
    public ScoreTrackerDTO setDayPlayers(String email, Long leagueId, Long dayId, List<Long> playerIds) {
        Long userId = userId(email);
        League league = visible(userId, leagueId);
        lookup.dayOf(leagueId, dayId);
        replaceDayPlayers(dayId, lookup.chosenPlayers(leagueId, playerIds));
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
        ScoreDay day = lookup.dayOf(leagueId, dayId);
        if (day.isOpen()) {
            List<ScoreTrackerSession> leagueSessions = sessions.findByLeagueIdOrderByIdAsc(leagueId);
            List<ScoreTrackerRound> leagueRounds = rounds.findByLeagueIdOrderByIdAsc(leagueId);
            Set<Long> playedSessions = leagueRounds.stream().map(ScoreTrackerRound::getSessionId)
                    .collect(Collectors.toSet());
            boolean hasOpenResults = leagueSessions.stream()
                    .anyMatch(session -> session.getDayId().equals(dayId) && session.isOpen()
                            && playedSessions.contains(session.getId()));
            if (hasOpenResults) throw BusinessException.conflict("Termina la partida antes de cerrar el día");
            finishDay(day, Instant.now(), leagueSessions, leagueRounds);
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
        Long game = gameId != null ? lookup.gameOf(leagueId, gameId).getId()
                : last != null ? last.getGameId() : lookup.firstGame(leagueId).getId();
        List<Long> chosen = playerIds == null || playerIds.isEmpty() ? null : lookup.chosenPlayers(leagueId, playerIds);
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
            if (sessions.findByLeagueIdOrderByIdAsc(leagueId).stream().anyMatch(ScoreTrackerSession::isOpen)) {
                throw BusinessException.conflict("Termina la partida abierta antes de empezar otra");
            }
            startSession(leagueId, game, chosen, plannedRounds, userId);
        }
        return changed(league, userId);
    }

    /** Crea la partida en el día en curso, o en uno nuevo si no lo hay. */
    private ScoreTrackerSession startSession(Long leagueId, Long gameId, List<Long> chosen, Integer plannedRounds,
                                             Long userId) {
        ScoreDay day = currentDay(leagueId);
        if (day == null) day = newDay(leagueId, chosen != null ? chosen : lookup.playerIds(leagueId), userId);
        List<Long> participants = chosen;
        if (participants == null) {
            participants = dayPlayers.findByDayId(day.getId()).stream().map(ScoreDayPlayer::getPlayerId).toList();
            if (participants.isEmpty()) participants = List.copyOf(lookup.playerIds(leagueId));
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
        ScoreTrackerSession session = lookup.sessionOf(leagueId, sessionId);
        requireEditable(league, userId, session);
        List<Long> chosen = lookup.chosenPlayers(leagueId, playerIds);
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
        ScoreTrackerSession session = lookup.sessionOf(leagueId, sessionId);
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
        ScoreTrackerSession session = lookup.sessionOf(leagueId, sessionId);
        if (!session.isOpen()) {
            if (!administers(league, userId)) throw BusinessException.forbidden("Solo quien administra puede reabrir partidas");
            if (!lookup.dayOf(leagueId, session.getDayId()).isOpen()) {
                throw BusinessException.conflict("El día ya está cerrado; puedes corregir sus rondas sin reabrirlo");
            }
            if (sessions.findByLeagueIdOrderByIdAsc(leagueId).stream().anyMatch(ScoreTrackerSession::isOpen)) {
                throw BusinessException.conflict("Termina la partida abierta antes de reabrir otra");
            }
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
        if (request.targetWins() != null && (request.targetWins() < 1 || request.targetWins() > 500
                || !(ScoreGame.MODE_WINS.equals(request.mode()) || ScoreGame.MODE_ROUNDS.equals(request.mode())))) {
            throw BusinessException.badRequest("El objetivo debe ser de 1 a 500 rondas ganadas");
        }
        ScoreGame game = newGame(leagueId, name, request.unit(), request.lowerWins(), request.mode());
        game.setTargetWins(request.targetWins());
        games.save(game);
        return changed(league, userId);
    }

    /** En los juegos por victorias no hay «gana quien menos» y la unidad por defecto son las victorias. */
    private static ScoreGame newGame(Long leagueId, String name, String unit, boolean lowerWins, String mode) {
        boolean wins = ScoreGame.MODE_WINS.equals(mode) || ScoreGame.MODE_DIRECT.equals(mode);
        String selectedMode = wins || ScoreGame.MODE_ROUNDS.equals(mode) ? mode : ScoreGame.MODE_POINTS;
        String cleanUnit = clean(unit);
        return ScoreGame.builder().leagueId(leagueId).name(name)
                .unit(cleanUnit.isEmpty() ? (wins ? "victorias" : "puntos") : cleanUnit)
                .lowerWins(!wins && lowerWins).mode(selectedMode).build();
    }

    @Transactional
    public ScoreTrackerDTO renameGame(String email, Long leagueId, Long gameId, ScoreGameNameRequest request) {
        Long userId = userId(email);
        League league = owned(userId, leagueId);
        ScoreGame game = lookup.gameOf(leagueId, gameId);
        String name = gameName(request.name(), "");
        if (name.isEmpty()) throw BusinessException.badRequest("Ponle nombre al juego");
        requireFreeGameName(games.findByLeagueIdOrderByIdAsc(leagueId), name, gameId);
        game.setName(name);
        String unit = clean(request.unit());
        if (!unit.isEmpty()) game.setUnit(unit);
        games.save(game);
        return changed(league, userId);
    }

    /** Un juego solo se borra si no tiene rondas apuntadas. */
    @Transactional
    public ScoreTrackerDTO deleteGame(String email, Long leagueId, Long gameId) {
        Long userId = userId(email);
        League league = owned(userId, leagueId);
        ScoreGame game = lookup.gameOf(leagueId, gameId);
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

    /** Borra un día de juego apuntado por error, con sus partidas (solo el administrador). */
    @Transactional
    public ScoreTrackerDTO deleteDay(String email, Long leagueId, Long dayId) {
        Long userId = userId(email);
        League league = owned(userId, leagueId);
        days.delete(lookup.dayOf(leagueId, dayId));
        days.flush();
        return changed(league, userId);
    }

    /**
     * Cambia la fecha de un día de juego terminado, para apuntar uno pasado: se juega, se cierra y se le pone
     * el día en que fue. La fecha de juego no altera los instantes de creación y cierre.
     */
    @Transactional
    public ScoreTrackerDTO moveDay(String email, Long leagueId, Long dayId, LocalDate date) {
        Long userId = userId(email);
        League league = owned(userId, leagueId);
        ScoreDay day = lookup.dayOf(leagueId, dayId);
        if (day.isOpen()) throw BusinessException.badRequest("Cierra el día antes de cambiarle la fecha");
        if (date.isAfter(LocalDate.now(ZoneId.of("Europe/Madrid"))))
            throw BusinessException.badRequest("La fecha no puede ser futura");
        if (date.equals(day.getPlayedOn())) return view(league, userId);
        day.setPlayedOn(date);
        days.save(day);
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

    public ScoreTrackerDTO changed(League league, Long userId) {
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
        AfterCommit.run(() -> webSocketService.notifyTrackerChanged(leagueId, audience));
    }

    public ScoreTrackerDTO view(League league, Long userId) {
        return viewBuilder.build(league, userId);
    }
}
