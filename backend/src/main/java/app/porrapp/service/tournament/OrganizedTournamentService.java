package app.porrapp.service.tournament;

import app.porrapp.dto.OrganizedTournamentDTO;
import app.porrapp.dto.OrganizedTournamentDTO.*;
import app.porrapp.exception.BusinessException;
import app.porrapp.model.League;
import app.porrapp.model.Membership;
import app.porrapp.model.OrganizedTournament;
import app.porrapp.model.TournamentResultChange;
import app.porrapp.model.UserAccount;
import app.porrapp.repository.*;
import app.porrapp.util.JoinCodeGenerator;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

@Service @RequiredArgsConstructor
public class OrganizedTournamentService {
    private final OrganizedTournamentRepository tournaments;
    private final TournamentResultChangeRepository changes;
    private final LeagueRepository leagues;
    private final UserAccountRepository users;
    private final MembershipRepository memberships;
    private final EntityManager entityManager;

    @Transactional @CacheEvict(value = "userGroups", key = "#email")
    public OrganizedTournamentDTO create(String email, Create request) {
        UserAccount user = users.findByGoogleEmail(email).orElseThrow(() -> BusinessException.forbidden("Inicia sesión para crear un torneo."));
        entityManager.lock(user, LockModeType.PESSIMISTIC_WRITE);
        Optional<League> previous = leagues.findByAdminUserIdAndCreationKey(user.getId(), request.creationKey().toString());
        if (previous.isPresent()) return view(owned(email, previous.get().getId(), false));
        if (leagues.findByAdminUserId(user.getId()).stream().filter(League::isTournament).count() >= 30) {
            throw BusinessException.badRequest("Puedes administrar hasta 30 torneos.");
        }
        League league = leagues.save(League.builder().name(request.name().strip()).adminUser(user)
                .kind(League.KIND_TOURNAMENT).joinCode(JoinCodeGenerator.next()).creationKey(request.creationKey().toString()).build());
        memberships.save(Membership.builder().id(new Membership.MembershipId(user.getId(), league.getId()))
                .user(user).league(league).role("ADMIN").build());
        OrganizedTournament tournament = new OrganizedTournament();
        tournament.setLeague(league);
        tournament.setActivity(request.activity().strip());
        tournament.setParticipantType(request.participantType());
        return view(tournaments.saveAndFlush(tournament));
    }

    @Transactional(readOnly = true)
    public OrganizedTournamentDTO get(String email, Long id) {
        OrganizedTournament tournament = find(id, false);
        if (canOrganize(tournament, email)) return view(tournament);

        UserAccount member = email == null ? null : users.findByGoogleEmail(email).orElse(null);
        if (member == null || !memberships.existsById(new Membership.MembershipId(member.getId(), id))) {
            throw BusinessException.forbidden("No perteneces a este torneo.");
        }
        return view(tournament, false);
    }

    @Transactional(readOnly = true)
    public OrganizedTournamentDTO publicView(UUID publicId) {
        return view(tournaments.findByPublicIdAndPublishedTrue(publicId)
                .orElseThrow(() -> BusinessException.notFound("Este torneo no está publicado o el enlace ya no está disponible.")), false);
    }

    @Transactional
    public OrganizedTournamentDTO publish(String email, Long id, Publication request) {
        OrganizedTournament tournament = edit(email, id, request.revision());
        tournament.setPublished(request.published());
        return view(tournament);
    }

    @Transactional
    public OrganizedTournamentDTO addParticipant(String email, Long id, ParticipantInput request) {
        OrganizedTournament tournament = edit(email, id, request.revision());
        if (tournament.getParticipants().size() >= 64) throw BusinessException.badRequest("El límite es de 64 participantes.");
        requireNoSchedule(tournament);
        List<Participant> participants = new ArrayList<>(tournament.getParticipants());
        checkName(participants, request.name(), null);
        participants.add(new Participant(UUID.randomUUID().toString(), request.name().strip()));
        tournament.setParticipants(participants);
        return view(tournament);
    }

    @Transactional
    public OrganizedTournamentDTO renameParticipant(String email, Long id, String participantId, ParticipantInput request) {
        OrganizedTournament tournament = edit(email, id, request.revision());
        requireParticipant(tournament, participantId);
        checkName(tournament.getParticipants(), request.name(), participantId);
        tournament.setParticipants(tournament.getParticipants().stream().map(p -> p.id().equals(participantId)
                ? new Participant(p.id(), request.name().strip()) : p).toList());
        return view(tournament);
    }

    @Transactional
    public OrganizedTournamentDTO removeParticipant(String email, Long id, String participantId, long revision) {
        OrganizedTournament tournament = edit(email, id, revision);
        requireNoSchedule(tournament);
        requireParticipant(tournament, participantId);
        tournament.setParticipants(tournament.getParticipants().stream().filter(p -> !p.id().equals(participantId)).toList());
        return view(tournament);
    }

    @Transactional
    public OrganizedTournamentDTO order(String email, Long id, Order request) {
        OrganizedTournament tournament = edit(email, id, request.revision());
        requireNoSchedule(tournament);
        Map<String, Participant> participants = new HashMap<>();
        tournament.getParticipants().forEach(p -> participants.put(p.id(), p));
        if (request.participantIds().size() != participants.size()
                || !new HashSet<>(request.participantIds()).equals(participants.keySet())) {
            throw BusinessException.badRequest("El orden debe incluir una vez a cada participante.");
        }
        tournament.setParticipants(request.participantIds().stream().map(participants::get).toList());
        return view(tournament);
    }

    @Transactional
    public OrganizedTournamentDTO generate(String email, Long id, Schedule request) {
        OrganizedTournament tournament = edit(email, id, request.revision());
        requireNoSchedule(tournament);
        if (tournament.getParticipants().size() < 2) throw BusinessException.badRequest("Añade al menos dos participantes.");
        tournament.setFormat(request.format());
        tournament.setWinPoints(request.winPoints());
        tournament.setDrawPoints(request.drawPoints());
        tournament.setLossPoints(request.lossPoints());
        tournament.setMatches("LEAGUE".equals(request.format())
                ? TournamentSchedule.league(tournament.getParticipants(), request.legs())
                : TournamentSchedule.knockout(tournament.getParticipants(), request.draw()));
        return view(tournament);
    }

    @Transactional
    public OrganizedTournamentDTO swap(String email, Long id, Swap request) {
        OrganizedTournament tournament = edit(email, id, request.revision());
        if (!"KNOCKOUT".equals(tournament.getFormat())) throw BusinessException.badRequest("Solo puedes intercambiar posiciones en una eliminatoria.");
        requireParticipant(tournament, request.firstId());
        requireParticipant(tournament, request.secondId());
        if (request.firstId().equals(request.secondId())) throw BusinessException.badRequest("Elige dos participantes distintos.");
        if (tournament.getMatches().stream().anyMatch(m -> m.outcome() != null && !m.bye())) {
            throw BusinessException.conflict("El cuadro ya tiene resultados. No se pueden intercambiar posiciones.");
        }
        tournament.setMatches(TournamentSchedule.swap(tournament.getMatches(), request.firstId(), request.secondId()));
        return view(tournament);
    }

    @Transactional
    public OrganizedTournamentDTO clearSchedule(String email, Long id, long revision) {
        OrganizedTournament tournament = edit(email, id, revision);
        if (tournament.getMatches().stream().anyMatch(m -> m.outcome() != null && !m.bye())) {
            throw BusinessException.conflict("Hay resultados guardados. Bórralos antes de rehacer el calendario.");
        }
        tournament.setMatches(List.of());
        tournament.setFormat("MANUAL");
        return view(tournament);
    }

    @Transactional
    public OrganizedTournamentDTO addMatch(String email, Long id, MatchInput request) {
        OrganizedTournament tournament = edit(email, id, request.revision());
        if (!"MANUAL".equals(tournament.getFormat())) throw BusinessException.badRequest("El calendario ya se ha generado automáticamente.");
        if (tournament.getMatches().size() >= 512) throw BusinessException.badRequest("El límite manual es de 512 encuentros.");
        requireParticipant(tournament, request.homeId()); requireParticipant(tournament, request.awayId());
        if (request.homeId().equals(request.awayId())) throw BusinessException.badRequest("Elige dos participantes distintos.");
        List<Match> matches = new ArrayList<>(tournament.getMatches());
        matches.add(new Match(UUID.randomUUID().toString(), request.round(), matches.size(), request.homeId(), request.awayId(),
                request.scheduledAt(), clean(request.venue()), null, null, null, false));
        tournament.setMatches(matches);
        return view(tournament);
    }

    @Transactional
    public OrganizedTournamentDTO details(String email, Long id, String matchId, MatchDetails request) {
        OrganizedTournament tournament = edit(email, id, request.revision());
        Match match = requireMatch(tournament, matchId);
        replace(tournament, new Match(match.id(), match.round(), match.position(), match.homeId(), match.awayId(),
                request.scheduledAt(), clean(request.venue()), match.homeScore(), match.awayScore(), match.outcome(), match.bye()));
        return view(tournament);
    }

    @Transactional
    public OrganizedTournamentDTO result(String email, Long id, String matchId, Result request) {
        OrganizedTournament tournament = edit(email, id, request.revision());
        Match before = requireMatch(tournament, matchId);
        if (before.bye() || before.homeId() == null || before.awayId() == null) {
            throw BusinessException.badRequest("Este encuentro todavía no tiene dos participantes.");
        }
        if ((request.homeScore() == null) != (request.awayScore() == null)) {
            throw BusinessException.badRequest("Introduce los dos marcadores o deja ambos vacíos.");
        }
        String outcome = request.outcome();
        if (request.homeScore() != null) {
            int comparison = Integer.compare(request.homeScore(), request.awayScore());
            String scoredOutcome = comparison > 0 ? "HOME" : comparison < 0 ? "AWAY" : "DRAW";
            if (outcome == null) outcome = scoredOutcome;
            if (comparison != 0 && !outcome.equals(scoredOutcome)) {
                throw BusinessException.badRequest("El ganador no coincide con el marcador.");
            }
        }
        if ("KNOCKOUT".equals(tournament.getFormat()) && "DRAW".equals(outcome)) {
            throw BusinessException.badRequest("La eliminatoria necesita un ganador. Indica quién ganó el desempate.");
        }
        Match after = before.withResult(request.homeScore(), request.awayScore(), outcome);
        replace(tournament, after);
        if ("KNOCKOUT".equals(tournament.getFormat())) tournament.setMatches(TournamentSchedule.advance(tournament.getMatches()));
        TournamentResultChange change = new TournamentResultChange();
        change.setTournamentId(id); change.setRevision(tournament.getRevision());
        change.setActorId(users.findByGoogleEmail(email).orElseThrow().getId()); change.setBeforeResult(before); change.setAfterResult(after);
        changes.save(change);
        return view(tournament);
    }

    private OrganizedTournament edit(String email, Long id, long revision) {
        OrganizedTournament tournament = owned(email, id, true);
        if (tournament.getRevision() != revision) throw BusinessException.conflict("El torneo ha cambiado. Actualiza la página antes de guardar.");
        tournament.setRevision(revision + 1);
        return tournament;
    }

    private OrganizedTournament owned(String email, Long id, boolean lock) {
        OrganizedTournament tournament = find(id, lock);
        if (!canOrganize(tournament, email)) {
            throw BusinessException.forbidden("Solo quien administra el torneo puede editarlo.");
        }
        return tournament;
    }

    private OrganizedTournament find(Long id, boolean lock) {
        return (lock ? tournaments.findLocked(id) : tournaments.findById(id))
                .orElseThrow(() -> BusinessException.notFound("Torneo no encontrado."));
    }

    private static boolean canOrganize(OrganizedTournament tournament, String email) {
        return tournament.getLeague().canOrganize(email);
    }

    private static void requireNoSchedule(OrganizedTournament tournament) {
        if (!tournament.getMatches().isEmpty()) throw BusinessException.conflict("Borra el calendario antes de cambiar los participantes o generar otro.");
    }

    private static void requireParticipant(OrganizedTournament tournament, String id) {
        if (tournament.getParticipants().stream().noneMatch(p -> p.id().equals(id))) throw BusinessException.notFound("Participante no encontrado en este torneo.");
    }

    private static void checkName(List<Participant> participants, String name, String currentId) {
        if (participants.stream().anyMatch(p -> !p.id().equals(currentId) && p.name().equalsIgnoreCase(name.strip()))) {
            throw BusinessException.badRequest("Ya hay un participante con ese nombre.");
        }
    }

    private static Match requireMatch(OrganizedTournament tournament, String id) {
        return tournament.getMatches().stream().filter(m -> m.id().equals(id)).findFirst()
                .orElseThrow(() -> BusinessException.notFound("Encuentro no encontrado en este torneo."));
    }

    private static void replace(OrganizedTournament tournament, Match updated) {
        tournament.setMatches(tournament.getMatches().stream().map(m -> m.id().equals(updated.id()) ? updated : m).toList());
    }

    private static String clean(String value) { return value == null || value.isBlank() ? null : value.strip(); }

    private static OrganizedTournamentDTO view(OrganizedTournament tournament) {
        return view(tournament, true);
    }

    private static OrganizedTournamentDTO view(OrganizedTournament tournament, boolean canEdit) {
        String publicId = canEdit || tournament.isPublished() ? tournament.getPublicId().toString() : null;
        return new OrganizedTournamentDTO(tournament.getId(), tournament.getLeague().getName(), tournament.getActivity(),
                tournament.getParticipantType(), tournament.getFormat(), tournament.isPublished(), publicId, canEdit,
                tournament.getRevision(), tournament.getWinPoints(), tournament.getDrawPoints(), tournament.getLossPoints(),
                tournament.getParticipants(), tournament.getMatches(), "KNOCKOUT".equals(tournament.getFormat()) ? List.of()
                : TournamentSchedule.standings(tournament.getParticipants(), tournament.getMatches(), tournament.getWinPoints(),
                        tournament.getDrawPoints(), tournament.getLossPoints()));
    }
}
