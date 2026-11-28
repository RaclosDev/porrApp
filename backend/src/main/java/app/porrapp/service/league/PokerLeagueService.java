package app.porrapp.service.league;

import app.porrapp.dto.PokerDTO.*;
import app.porrapp.exception.BusinessException;
import app.porrapp.model.League;
import app.porrapp.model.Membership;
import app.porrapp.model.PokerSession;
import app.porrapp.model.ScoreTrackerPlayer;
import app.porrapp.model.UserAccount;
import app.porrapp.repository.LeagueRepository;
import app.porrapp.repository.MembershipRepository;
import app.porrapp.repository.PokerSessionRepository;
import app.porrapp.repository.ScoreTrackerPlayerRepository;
import app.porrapp.repository.UserAccountRepository;
import app.porrapp.util.JoinCodeGenerator;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class PokerLeagueService {
    private final LeagueRepository leagues;
    private final UserAccountRepository users;
    private final MembershipRepository memberships;
    private final ScoreboardRoster roster;
    private final ScoreTrackerPlayerRepository players;
    private final PokerSessionRepository sessions;
    private final org.springframework.context.ApplicationEventPublisher events;

    /** Torneos abiertos a la vez por liga (programados o en juego). */
    static final int MAX_OPEN_SESSIONS = 5;

    @Transactional
    @CacheEvict(value = "userGroups", key = "#email")
    public LeagueView create(String email, CreateLeague request) {
        UserAccount owner = account(email);
        String key = request.creationKey().toString();
        League existing = leagues.findByAdminUserIdAndCreationKey(owner.getId(), key).orElse(null);
        if (existing != null) {
            if (!existing.isPoker()) throw BusinessException.conflict("La solicitud ya se ha usado");
            return view(existing, owner.getId());
        }
        if (leagues.findByAdminUserId(owner.getId()).stream().filter(League::isPoker).count() >= 20) {
            throw BusinessException.badRequest("Has llegado al máximo de ligas de póker");
        }
        League league = leagues.save(League.builder().name(request.name().strip()).adminUser(owner)
                .kind(League.KIND_POKER).joinCode(JoinCodeGenerator.unique(code -> leagues.findByJoinCode(code).isPresent())).creationKey(key).build());
        memberships.save(Membership.builder().id(new Membership.MembershipId(owner.getId(), league.getId()))
                .user(owner).league(league).role("ADMIN").build());
        roster.memberJoined(league, owner);
        return view(league, owner.getId());
    }

    @Transactional(readOnly = true)
    public LeagueView get(String email, Long leagueId) {
        Long userId = account(email).getId();
        return view(visible(leagueId, userId, false), userId);
    }

    @Transactional(readOnly = true)
    public List<Session> history(String email, Long leagueId) {
        visible(leagueId, account(email).getId(), false);
        long now = System.currentTimeMillis();
        return sessions.findByLeagueIdAndClosedAtIsNotNullOrderByScheduledOnDescIdDesc(leagueId).stream()
                .map(session -> PokerTournament.view(session, now)).toList();
    }

    @Transactional
    public List<Session> editResults(String email, Long leagueId, Long sessionId, EditResults request) {
        Long userId = account(email).getId();
        PokerSession session = closedSession(administered(leagueId, userId), sessionId);
        checkRevision(session, request.revision());
        PokerTournament.editResults(session, request);
        session.setRevision(session.getRevision() + 1);
        sessions.flush();
        return history(email, leagueId);
    }

    @Transactional
    public List<Session> deleteResult(String email, Long leagueId, Long sessionId) {
        Long userId = account(email).getId();
        sessions.delete(closedSession(administered(leagueId, userId), sessionId));
        sessions.flush();
        return history(email, leagueId);
    }

    /** Abre o cierra la organización de los torneos a todos los miembros; solo la administración lo decide. */
    @Transactional
    public LeagueView organizing(String email, Long leagueId, Organizing request) {
        Long userId = account(email).getId();
        League league = visible(leagueId, userId, true);
        if (!league.isAdmin(userId)) {
            throw BusinessException.forbidden("Solo la administración de la liga puede cambiar quién organiza");
        }
        league.setPokerEveryoneOrganizes(request.everyoneOrganizes());
        return view(league, userId);
    }

    /** El histórico solo lo corrigen quien creó la liga y sus administradores. */
    private League administered(Long leagueId, Long userId) {
        League league = visible(leagueId, userId, true);
        if (!league.isAdmin(userId)) {
            throw BusinessException.forbidden("Solo la administración de la liga puede cambiar el histórico");
        }
        return league;
    }

    private PokerSession closedSession(League league, Long sessionId) {
        PokerSession session = sessions.findByIdAndLeagueId(sessionId, league.getId())
                .orElseThrow(() -> BusinessException.notFound("Torneo no encontrado"));
        if (session.getClosedAt() == null) throw BusinessException.conflict("El torneo todavía no está cerrado");
        return session;
    }

    @Transactional
    public LeagueView addGuest(String email, Long leagueId, Long sessionId, String name) {
        Long userId = account(email).getId();
        League league = owned(leagueId, userId);
        // Con la mesa empezada también se puede sumar a quien llega tarde.
        PokerSession session = openSession(leagueId, sessionId);
        requireSeat(session);
        List<ScoreTrackerPlayer> existing = players.findByLeagueIdOrderByPositionAsc(leagueId);
        if (existing.size() >= ScoreboardRoster.MAX_POKER_ROSTER) {
            throw BusinessException.badRequest("La liga ha alcanzado el máximo de jugadores");
        }
        String clean = name.strip().replaceAll("\\s+", " ");
        if (existing.stream().anyMatch(player -> player.getName().equalsIgnoreCase(clean))) {
            throw BusinessException.conflict("Ya hay un jugador con ese nombre");
        }
        ScoreTrackerPlayer guest = players.save(ScoreTrackerPlayer.builder()
                .leagueId(leagueId).name(clean).position(existing.size()).build());
        List<Entry> entries = new ArrayList<>(session.getEntries());
        entries.add(new Entry(guest.getId(), guest.getName(), 0, 0));
        session.setEntries(entries);
        return changed(league, userId, session);
    }

    /**
     * Quita a un invitado sin cuenta. Lo hace la administración de la liga y solo si no está apuntado a
     * un torneo abierto; en los cerrados queda su nombre, que va guardado en cada resultado.
     */
    @Transactional
    public LeagueView removeGuest(String email, Long leagueId, Long playerId) {
        Long userId = account(email).getId();
        League league = visible(leagueId, userId, true);
        if (!league.isAdmin(userId)) {
            throw BusinessException.forbidden("Solo la administración de la liga puede quitar invitados");
        }
        ScoreTrackerPlayer guest = players.findById(playerId)
                .filter(player -> player.getLeagueId().equals(leagueId))
                .orElseThrow(() -> BusinessException.notFound("Jugador no encontrado"));
        if (guest.getUserId() != null) {
            throw BusinessException.conflict("Ese jugador tiene cuenta: quítalo desde los miembros de la liga");
        }
        boolean signedUp = sessions.findByLeagueIdAndClosedAtIsNullOrderByScheduledOnAscIdAsc(leagueId).stream()
                .anyMatch(session -> session.getEntries().stream().anyMatch(entry -> entry.playerId() == playerId));
        if (signedUp) {
            throw BusinessException.conflict("Está apuntado a un torneo abierto: quítalo antes de ese torneo");
        }
        players.delete(guest);
        players.flush();
        return view(league, userId);
    }

    @Transactional
    public LeagueView schedule(String email, Long leagueId, CreateSession request) {
        Long userId = account(email).getId();
        League league = owned(leagueId, userId);
        PokerTournament.validate(request.settings());
        if (sessions.countByLeagueIdAndClosedAtIsNull(leagueId) >= MAX_OPEN_SESSIONS) {
            throw BusinessException.conflict("Ya hay " + MAX_OPEN_SESSIONS + " torneos programados en la liga");
        }
        var session = new PokerSession();
        session.setLeagueId(leagueId);
        session.setScheduledOn(request.date());
        session.setSettings(request.settings());
        sessions.save(session);
        var recipients = memberships.findByLeagueId(leagueId).stream()
                .map(member -> member.getUser().getId()).filter(id -> !id.equals(userId))
                .collect(java.util.stream.Collectors.toSet());
        events.publishEvent(new PokerNotificationEvent(recipients,
                new app.porrapp.service.notification.PushMessage("Nuevo torneo de póker",
                        league.getName() + " · " + request.date().format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy"))
                                + ". Apúntate y confirma tu asistencia.",
                        "/?group=" + leagueId, "poker-scheduled-" + session.getId()),
                System.currentTimeMillis() + 24 * 60 * 60 * 1000L));
        return view(league, userId);
    }

    @Transactional
    public LeagueView edit(String email, Long leagueId, Long sessionId, EditSession request) {
        Long userId = account(email).getId();
        League league = owned(leagueId, userId);
        PokerSession session = openSession(leagueId, sessionId);
        checkRevision(session, request.revision());
        if (session.getStartedAt() != null) {
            // Con la mesa en juego se corrigen los ajustes sobre la marcha; la fecha ya no cambia.
            PokerTournament.editLive(session, request.settings(), System.currentTimeMillis());
            return changed(league, userId, session);
        }
        PokerTournament.validate(request.settings());
        session.setScheduledOn(request.date());
        session.setSettings(request.settings());
        return changed(league, userId, session);
    }

    @Transactional
    public LeagueView attendance(String email, Long leagueId, Long sessionId, Attendance request) {
        Long userId = account(email).getId();
        League league = visible(leagueId, userId, true);
        PokerSession session = openSession(leagueId, sessionId);
        // Quien llega tarde puede entrar con la mesa empezada. Salir, solo antes de empezar; después, solo
        // lo saca quien organiza (por si se apuntó por error).
        if (!request.attending() && request.playerId() == null) registration(session);
        ScoreTrackerPlayer player;
        if (request.playerId() == null) {
            player = players.findByLeagueIdAndUserId(leagueId, userId)
                    .orElseThrow(() -> BusinessException.notFound("No se encontró tu jugador"));
        } else {
            requireOwner(league, userId);
            player = players.findById(request.playerId())
                    .filter(candidate -> candidate.getLeagueId().equals(leagueId))
                    .orElseThrow(() -> BusinessException.notFound("Jugador no encontrado"));
        }
        List<Entry> entries = new ArrayList<>(session.getEntries());
        boolean attending = entries.stream().anyMatch(entry -> entry.playerId() == player.getId());
        if (request.attending() == attending) return view(league, userId);
        if (request.attending()) {
            requireSeat(session);
            entries.add(new Entry(player.getId(), player.getName(), 0, 0));
        } else if (session.getStartedAt() != null) {
            PokerTournament.removeEntry(session, player.getId());
            return changed(league, userId, session);
        } else {
            entries.removeIf(entry -> entry.playerId() == player.getId());
        }
        session.setEntries(entries);
        return changed(league, userId, session);
    }

    private static final java.util.Set<Action> PLAYER_MARKS = java.util.EnumSet.of(Action.REBUY, Action.ADD_ON,
            Action.UNDO_REBUY, Action.UNDO_ADD_ON, Action.ELIMINATE, Action.UNDO_ELIMINATION);

    @Transactional
    public LeagueView command(String email, Long leagueId, Long sessionId, Command command) {
        Long userId = account(email).getId();
        // Recompras, add-ons y eliminaciones los apunta cualquier miembro; el resto, solo quien organiza.
        League league = PLAYER_MARKS.contains(command.action())
                ? visible(leagueId, userId, true)
                : owned(leagueId, userId);
        PokerSession session = openSession(leagueId, sessionId);
        checkRevision(session, command.revision());
        if (command.action() == Action.CANCEL) {
            registration(session);
            sessions.delete(session);
            return view(league, userId);
        }
        BlindClock previous = session.getBlindClock();
        PokerTournament.apply(session, command, System.currentTimeMillis());
        session.setBlindClock(PokerTournament.clockAt(session.getBlindClock(), session.getSettings().levels(),
                System.currentTimeMillis()));
        notifyClock(league, session, previous);
        return changed(league, userId, session);
    }

    @Transactional
    public void advanceClock(Long leagueId) {
        League league = leagues.findWithLockById(leagueId).orElse(null);
        if (league == null) return;
        for (PokerSession session : sessions.findByLeagueIdAndClosedAtIsNullOrderByScheduledOnAscIdAsc(leagueId)) {
            BlindClock previous = session.getBlindClock();
            if (previous == null) continue;
            BlindClock current = PokerTournament.clockAt(previous, session.getSettings().levels(),
                    System.currentTimeMillis());
            if (current.level() == previous.level()
                    && (current.remainingMs() == 0) == (previous.remainingMs() == 0)) continue;
            session.setBlindClock(current);
            notifyClock(league, session, previous);
        }
    }

    private void notifyClock(League league, PokerSession session, BlindClock previous) {
        BlindClock current = session.getBlindClock();
        if (current == null || session.getClosedAt() != null) return;
        if (previous != null && previous.level() == current.level()
                && (previous.remainingMs() == 0) == (current.remainingMs() == 0)) return;
        BlindLevel level = session.getSettings().levels().get(current.level());
        String title;
        String body;
        if (previous == null) {
            title = "Ha empezado el torneo";
            body = "Entra en la mesa. Ciegas " + level.small() + " / " + level.big()
                    + (level.ante() > 0 ? " · Ante " + level.ante() : "") + ".";
        } else if (current.remainingMs() == 0) {
            title = "Ha terminado el último nivel";
            body = "Se mantienen las ciegas " + level.small() + " / " + level.big() + " y el ante " + level.ante() + ".";
        } else if (level.big() == 0) {
            title = "Descanso de póker";
            body = "Empieza un descanso de " + level.minutes() + " minutos.";
        } else {
            // Los descansos no cuentan: tras el nivel 2 y el descanso, avisa del nivel 3.
            long number = session.getSettings().levels().stream().limit(current.level() + 1L)
                    .filter(blinds -> blinds.big() != 0).count();
            title = "Nivel " + number + " de póker";
            body = "Ciegas " + level.small() + " / " + level.big() + " · Ante " + level.ante()
                    + " · " + level.minutes() + " minutos.";
        }
        var entered = session.getEntries().stream().map(Entry::playerId).collect(java.util.stream.Collectors.toSet());
        var memberIds = memberships.findByLeagueId(league.getId()).stream().map(m -> m.getUser().getId())
                .collect(java.util.stream.Collectors.toSet());
        var recipients = players.findByLeagueIdOrderByPositionAsc(league.getId()).stream()
                .filter(player -> entered.contains(player.getId()) && memberIds.contains(player.getUserId()))
                .map(ScoreTrackerPlayer::getUserId).collect(java.util.stream.Collectors.toSet());
        events.publishEvent(new PokerNotificationEvent(recipients,
                new app.porrapp.service.notification.PushMessage(title, league.getName() + ". " + body,
                        "/poker/mesa?group=" + league.getId(), "poker-clock-" + session.getId()),
                current.endsAt() == null ? System.currentTimeMillis() + 300_000 : current.endsAt()));
    }

    private LeagueView changed(League league, Long userId, PokerSession session) {
        session.setRevision(session.getRevision() + 1);
        return view(league, userId);
    }

    private UserAccount account(String email) {
        return users.findByGoogleEmail(email)
                .orElseThrow(() -> BusinessException.notFound("Usuario no encontrado"));
    }

    private League visible(Long leagueId, Long userId, boolean lock) {
        if (!memberships.existsById(new Membership.MembershipId(userId, leagueId))) {
            throw BusinessException.notFound("Liga de póker no encontrada");
        }
        return (lock ? leagues.findWithLockById(leagueId) : leagues.findById(leagueId)).filter(League::isPoker)
                .orElseThrow(() -> BusinessException.notFound("Liga de póker no encontrada"));
    }

    private League owned(Long leagueId, Long userId) {
        League league = visible(leagueId, userId, true);
        requireOwner(league, userId);
        return league;
    }

    /** Quien organiza los torneos; llamar solo con la pertenencia a la liga ya comprobada. */
    private static boolean organizes(League league, Long userId) {
        return league.isPokerEveryoneOrganizes() || league.canOrganize(userId);
    }

    private static void requireOwner(League league, Long userId) {
        if (!organizes(league, userId)) {
            throw BusinessException.forbidden("Solo el organizador puede hacer ese cambio");
        }
    }

    private PokerSession openSession(Long leagueId, Long sessionId) {
        PokerSession session = sessions.findByIdAndLeagueId(sessionId, leagueId)
                .orElseThrow(() -> BusinessException.notFound("Torneo no encontrado"));
        if (session.getClosedAt() != null) throw BusinessException.conflict("El torneo ya está cerrado");
        return session;
    }

    private static void registration(PokerSession session) {
        if (session.getStartedAt() != null) throw BusinessException.conflict("El torneo ya ha empezado");
    }

    private static void requireSeat(PokerSession session) {
        if (session.getEntries().size() >= PokerTournament.MAX_ENTRIES) {
            throw BusinessException.conflict("Se ha alcanzado el máximo de " + PokerTournament.MAX_ENTRIES + " jugadores por torneo");
        }
    }

    private static void checkRevision(PokerSession session, long revision) {
        if (session.getRevision() != revision) {
            throw BusinessException.conflict("El torneo ha cambiado. Revisa los datos antes de intentarlo de nuevo");
        }
    }

    private LeagueView view(League league, Long userId) {
        long now = System.currentTimeMillis();
        Long id = league.getId();
        var rosterEntries = players.findByLeagueIdOrderByPositionAsc(id);
        Long myPlayerId = rosterEntries.stream().filter(player -> userId.equals(player.getUserId()))
                .findFirst().map(ScoreTrackerPlayer::getId).orElse(null);
        // Primero los que están en juego; después los programados, del más próximo al más lejano.
        List<Session> upcoming = sessions.findByLeagueIdAndClosedAtIsNullOrderByScheduledOnAscIdAsc(id).stream()
                .sorted(java.util.Comparator.comparing(session -> session.getStartedAt() == null))
                .map(session -> PokerTournament.view(session, now)).toList();
        Session current = upcoming.isEmpty() ? null : upcoming.get(0);
        Map<Long, String> avatars = new HashMap<>();
        users.findAllById(rosterEntries.stream().map(ScoreTrackerPlayer::getUserId).filter(Objects::nonNull).toList())
                .forEach(user -> avatars.put(user.getId(), user.getAvatarUrl()));
        return new LeagueView(id, league.getName(), league.getJoinCode(), organizes(league, userId),
                league.isAdmin(userId), league.isPokerEveryoneOrganizes(),
                myPlayerId, rosterEntries.stream()
                .map(player -> new Player(player.getId(), player.getName(), player.getUserId() == null,
                        player.getUserId(), avatars.get(player.getUserId()))).toList(),
                current, upcoming, now);
    }
}
