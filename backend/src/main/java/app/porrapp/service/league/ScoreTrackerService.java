package app.porrapp.service.league;

import app.porrapp.dto.ScoreGameNameRequest;
import app.porrapp.dto.ScoreGameRequest;
import app.porrapp.dto.ScoreTrackerDTO;
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
import app.porrapp.model.ScoreGame;
import app.porrapp.model.ScoreTrackerPlayer;
import app.porrapp.model.ScoreTrackerRound;
import app.porrapp.model.ScoreTrackerScore;
import app.porrapp.model.ScoreTrackerSession;
import app.porrapp.model.UserAccount;
import app.porrapp.repository.LeagueRepository;
import app.porrapp.repository.MembershipRepository;
import app.porrapp.repository.ScoreGameRepository;
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
 * Ligas de marcador de juegos de mesa o de cartas: el administrador apunta partidas y los miembros las
 * ven en directo, por sesiones, por juegos y en una clasificación general. No hay predicciones ni
 * puntos de porra. Una liga de marcador es una {@link League} sin edición ni competición.
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
        String unit = clean(request.unit());
        League league = leagues.save(League.builder().name(name).joinCode(newCode()).adminUser(owner)
                .kind(League.KIND_SCOREBOARD).build());
        memberships.save(Membership.builder().id(new Membership.MembershipId(userId, league.getId()))
                .user(owner).league(league).role("ADMIN").build());
        ScoreGame game = games.save(ScoreGame.builder().leagueId(league.getId())
                .name(gameName(request.gameName(), name)).unit(unit.isEmpty() ? "puntos" : unit)
                .lowerWins(request.lowerWins()).build());
        for (int i = 0; i < names.size(); i++) {
            players.save(ScoreTrackerPlayer.builder().leagueId(league.getId()).name(names.get(i))
                    .userId(i == 0 ? userId : null).position(i).build());
        }
        sessions.save(ScoreTrackerSession.builder().leagueId(league.getId()).gameId(game.getId()).build());
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

    @Transactional
    public ScoreTrackerDTO addRound(String email, Long leagueId, ScoreTrackerRoundRequest request) {
        Long userId = userId(email);
        League league = owned(userId, leagueId);
        List<ScoreTrackerPlayer> all = players.findByLeagueIdOrderByPositionAsc(leagueId);
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
        if (rounds.countByLeagueId(leagueId) >= MAX_ROUNDS) {
            throw BusinessException.badRequest("Este marcador ha llegado al máximo de partidas");
        }
        ScoreTrackerSession session = sessions.findFirstByLeagueIdOrderByIdDesc(leagueId)
                .orElseGet(() -> sessions.save(ScoreTrackerSession.builder().leagueId(leagueId)
                        .gameId(firstGame(leagueId).getId()).build()));
        String note = clean(request.note());
        ScoreTrackerRound round = rounds.save(ScoreTrackerRound.builder().leagueId(leagueId)
                .sessionId(session.getId()).note(note.isEmpty() ? null : note).build());
        for (ScoreTrackerPlayer player : all) {
            scores.save(ScoreTrackerScore.builder().roundId(round.getId()).playerId(player.getId())
                    .points(given.getOrDefault(player.getId(), 0)).build());
        }
        return changed(league, userId);
    }

    @Transactional
    public ScoreTrackerDTO deleteRound(String email, Long leagueId, Long roundId) {
        Long userId = userId(email);
        League league = owned(userId, leagueId);
        ScoreTrackerRound round = rounds.findById(roundId)
                .filter(found -> found.getLeagueId().equals(leagueId))
                .orElseThrow(() -> BusinessException.notFound("Partida no encontrada"));
        rounds.delete(round);
        return changed(league, userId);
    }

    private ScoreGame firstGame(Long leagueId) {
        return games.findByLeagueIdOrderByIdAsc(leagueId).stream().findFirst()
                .orElseThrow(() -> BusinessException.badRequest("La liga no tiene ningún juego"));
    }

    private ScoreGame gameOf(Long leagueId, Long gameId) {
        return games.findById(gameId).filter(game -> game.getLeagueId().equals(leagueId))
                .orElseThrow(() -> BusinessException.badRequest("Juego no válido"));
    }

    /**
     * Empieza una sesión nueva (otro día de juego, u otro juego el mismo día). Sin juego, sigue con el de la
     * sesión anterior. Si la sesión actual está vacía no hace falta otra: solo cambia de juego.
     */
    @Transactional
    public ScoreTrackerDTO newSession(String email, Long leagueId, Long gameId) {
        Long userId = userId(email);
        League league = owned(userId, leagueId);
        ScoreTrackerSession last = sessions.findFirstByLeagueIdOrderByIdDesc(leagueId).orElse(null);
        Long game = gameId != null ? gameOf(leagueId, gameId).getId()
                : last != null ? last.getGameId() : firstGame(leagueId).getId();
        boolean lastHasRounds = last != null && rounds.findByLeagueIdOrderByIdAsc(leagueId).stream()
                .anyMatch(round -> round.getSessionId().equals(last.getId()));
        if (last == null || lastHasRounds) {
            sessions.save(ScoreTrackerSession.builder().leagueId(leagueId).gameId(game).build());
        } else if (!last.getGameId().equals(game)) {
            last.setGameId(game);
            sessions.save(last);
        }
        return changed(league, userId);
    }

    /** Añade un juego a la liga (otro al que se juega algún día). */
    @Transactional
    public ScoreTrackerDTO addGame(String email, Long leagueId, ScoreGameRequest request) {
        Long userId = userId(email);
        League league = owned(userId, leagueId);
        String name = gameName(request.name(), "");
        if (name.isEmpty()) throw BusinessException.badRequest("Ponle nombre al juego");
        List<ScoreGame> existing = games.findByLeagueIdOrderByIdAsc(leagueId);
        if (existing.size() >= MAX_GAMES) throw BusinessException.badRequest("Máximo " + MAX_GAMES + " juegos");
        requireFreeGameName(existing, name, null);
        String unit = clean(request.unit());
        games.save(ScoreGame.builder().leagueId(leagueId).name(name).unit(unit.isEmpty() ? "puntos" : unit)
                .lowerWins(request.lowerWins()).build());
        return changed(league, userId);
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
        sessions.deleteAllById(gameSessions);
        sessions.flush();
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
        League league = owned(userId, leagueId);
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

        List<Session> sessionViews = new ArrayList<>();
        Map<Long, Map<Long, Integer>> sessionsWonByGame = new HashMap<>();
        Map<Long, Integer> sessionsWon = new HashMap<>();
        Map<Long, List<Map<Long, Integer>>> pointsByGame = new HashMap<>();
        Map<Long, Integer> sessionCountByGame = new HashMap<>();
        int number = 1;
        for (ScoreTrackerSession session : sessionList) {
            ScoreGame game = gameById.get(session.getGameId());
            List<ScoreTrackerRound> own = roundsBySession.getOrDefault(session.getId(), List.of());
            List<Map<Long, Integer>> ownPoints = own.stream()
                    .map(round -> pointsByRound.getOrDefault(round.getId(), Map.<Long, Integer>of())).toList();
            List<Standing> standings = ScoreTrackerStandings.rank(playerList, game != null && game.isLowerWins(),
                    ownPoints, Map.of());
            List<Long> winners = ScoreTrackerStandings.leaders(standings, own.size());
            Map<Long, Integer> wonInGame = sessionsWonByGame.computeIfAbsent(session.getGameId(), key -> new HashMap<>());
            winners.forEach(id -> {
                wonInGame.merge(id, 1, Integer::sum);
                sessionsWon.merge(id, 1, Integer::sum);
            });
            pointsByGame.computeIfAbsent(session.getGameId(), key -> new ArrayList<>()).addAll(ownPoints);
            sessionCountByGame.merge(session.getGameId(), 1, Integer::sum);
            sessionViews.add(new Session(session.getId(), number++, session.getGameId(),
                    session.getStartedAt().toString(), own.size(), standings, winners));
        }
        int roundNumber = 1;
        List<Round> roundViews = new ArrayList<>();
        for (ScoreTrackerRound round : roundList) {
            roundViews.add(new Round(round.getId(), round.getSessionId(), roundNumber++, round.getNote(),
                    round.getCreatedAt().toString(), pointsByRound.getOrDefault(round.getId(), Map.of())));
        }

        List<Game> gameViews = new ArrayList<>();
        List<GameStandings> byGame = new ArrayList<>();
        Map<Long, Integer> totals = new HashMap<>();
        Map<Long, Integer> roundsWon = new HashMap<>();
        for (ScoreGame game : gameRows) {
            List<Map<Long, Integer>> gamePoints = pointsByGame.getOrDefault(game.getId(), List.of());
            List<Standing> standings = ScoreTrackerStandings.rank(playerList, game.isLowerWins(), gamePoints,
                    sessionsWonByGame.getOrDefault(game.getId(), Map.of()));
            standings.forEach(standing -> {
                totals.merge(standing.playerId(), standing.total(), Integer::sum);
                roundsWon.merge(standing.playerId(), standing.roundsWon(), Integer::sum);
            });
            byGame.add(new GameStandings(game.getId(), standings));
            gameViews.add(new Game(game.getId(), game.getName(), game.getUnit(), game.isLowerWins(),
                    sessionCountByGame.getOrDefault(game.getId(), 0), gamePoints.size()));
        }
        List<Standing> overall = ScoreTrackerStandings.general(playerList, totals, roundsWon, sessionsWon);

        ScoreTrackerSession currentSession = sessionList.isEmpty() ? null : sessionList.get(sessionList.size() - 1);
        ScoreGame current = currentSession != null ? gameById.get(currentSession.getGameId())
                : gameRows.isEmpty() ? null : gameRows.get(0);
        return new ScoreTrackerDTO(leagueId, league.getName(), current == null ? "puntos" : current.getUnit(),
                current != null && current.isLowerWins(), administers(league, userId), league.getJoinCode(),
                myPlayerId, claimed, currentSession == null ? null : currentSession.getId(),
                current == null ? null : current.getId(), gameViews, playerList, sessionViews, roundViews,
                overall, byGame);
    }
}
