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
                .kind(League.KIND_POKER).joinCode(JoinCodeGenerator.next()).creationKey(key).build());
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
    public LeagueView addGuest(String email, Long leagueId, Long sessionId, String name) {
        Long userId = account(email).getId();
        League league = owned(leagueId, userId);
        PokerSession session = openSession(leagueId, sessionId);
        registration(session);
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

    @Transactional
    public LeagueView schedule(String email, Long leagueId, CreateSession request) {
        Long userId = account(email).getId();
        League league = owned(leagueId, userId);
        PokerTournament.validate(request.settings());
        if (sessions.existsByLeagueIdAndClosedAtIsNull(leagueId)) {
            throw BusinessException.conflict("Ya hay un torneo abierto en la liga");
        }
        var session = new PokerSession();
        session.setLeagueId(leagueId);
        session.setScheduledOn(request.date());
        session.setSettings(request.settings());
        sessions.save(session);
        return view(league, userId);
    }

    @Transactional
    public LeagueView edit(String email, Long leagueId, Long sessionId, EditSession request) {
        Long userId = account(email).getId();
        League league = owned(leagueId, userId);
        PokerSession session = openSession(leagueId, sessionId);
        registration(session);
        checkRevision(session, request.revision());
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
        registration(session);
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
        } else {
            entries.removeIf(entry -> entry.playerId() == player.getId());
        }
        session.setEntries(entries);
        return changed(league, userId, session);
    }

    @Transactional
    public LeagueView command(String email, Long leagueId, Long sessionId, Command command) {
        Long userId = account(email).getId();
        League league = owned(leagueId, userId);
        PokerSession session = openSession(leagueId, sessionId);
        checkRevision(session, command.revision());
        if (command.action() == Action.CANCEL) {
            registration(session);
            sessions.delete(session);
            return view(league, userId);
        }
        PokerTournament.apply(session, command, System.currentTimeMillis());
        return changed(league, userId, session);
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

    private static void requireOwner(League league, Long userId) {
        if (!userId.equals(league.getAdminUserId())) {
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
            throw BusinessException.conflict("Se ha alcanzado el máximo de 20 jugadores por torneo");
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
        Session current = sessions.findByLeagueIdAndClosedAtIsNull(id)
                .map(session -> PokerTournament.view(session, now)).orElse(null);
        Map<Long, String> avatars = new HashMap<>();
        users.findAllById(rosterEntries.stream().map(ScoreTrackerPlayer::getUserId).filter(Objects::nonNull).toList())
                .forEach(user -> avatars.put(user.getId(), user.getAvatarUrl()));
        return new LeagueView(id, league.getName(), league.getJoinCode(), userId.equals(league.getAdminUserId()),
                myPlayerId, rosterEntries.stream()
                .map(player -> new Player(player.getId(), player.getName(), player.getUserId() == null,
                        player.getUserId(), avatars.get(player.getUserId()))).toList(),
                current, now);
    }
}
