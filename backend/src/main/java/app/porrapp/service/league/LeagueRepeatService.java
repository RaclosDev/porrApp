package app.porrapp.service.league;

import app.porrapp.dto.MatchSelectionRequest;
import app.porrapp.exception.BusinessException;
import app.porrapp.model.Competition;
import app.porrapp.model.Edition;
import app.porrapp.model.League;
import app.porrapp.model.Match;
import app.porrapp.model.MatchSelectionMode;
import app.porrapp.model.Membership;
import app.porrapp.model.PoolFormat;
import app.porrapp.model.PredictionLockMode;
import app.porrapp.model.UserAccount;
import app.porrapp.repository.EditionFollowedTeamRepository;
import app.porrapp.repository.EditionRepository;
import app.porrapp.repository.LeagueRepository;
import app.porrapp.repository.MatchRepository;
import app.porrapp.repository.MembershipRepository;
import app.porrapp.scoring.ScoringRuleSet;
import app.porrapp.service.account.ProfileImageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * «Repetir liga»: cuando la temporada de una liga ha terminado y la competición ya tiene la siguiente, su
 * administrador crea otra liga para la temporada nueva con los mismos miembros y ajustes. Los puntos no se
 * heredan: la liga vieja se queda como está, con su clasificación final.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class LeagueRepeatService {

    private final LeagueRepository leagueRepository;
    private final EditionRepository editionRepository;
    private final MembershipRepository membershipRepository;
    private final MatchRepository matchRepository;
    private final EditionFollowedTeamRepository followedTeamRepository;
    private final LeagueSeasons leagueSeasons;
    private final LeagueSetupService leagueSetupService;
    private final ProfileImageService profileImageService;
    private final ApplicationEventPublisher eventPublisher;

    /**
     * Crea la liga de la temporada nueva. Solo el administrador; repetirlo (doble clic, reintento) devuelve
     * la liga ya creada en vez de otra.
     *
     * @throws BusinessException si no es el administrador, la temporada no ha terminado o aún no hay otra
     */
    @Transactional
    @CacheEvict(value = {"userGroups", "groupById", "groupByCode", "leaderboard"}, allEntries = true)
    public League repeat(Long leagueId, String email) {
        LeagueAdmins.require(leagueRepository, leagueId, email);
        // Con la fila bloqueada, dos peticiones a la vez no crean dos ligas: la segunda encuentra la primera.
        League old = leagueRepository.findWithLockById(leagueId)
                .orElseThrow(() -> BusinessException.notFound("Liga no encontrada"));
        UserAccount admin = old.getAdminUser();
        Optional<League> repeated = leagueRepository.findByPreviousLeagueId(leagueId);
        if (repeated.isPresent()) {
            Long repeatedId = repeated.get().getId();
            if (membershipRepository.existsById(new Membership.MembershipId(admin.getId(), repeatedId))) {
                return repeated.get();
            }
            throw BusinessException.conflict("Esta liga ya se ha repetido");
        }

        Edition edition = editionRepository.findByLeagueIdAndStatus(leagueId, "ACTIVE")
                .orElseThrow(() -> BusinessException.notFound("La liga no tiene una edición activa"));
        Competition played = edition.getCompetition();
        if (played == null || played.getOwnerLeague() != null) {
            throw BusinessException.badRequest("Una liga con competición propia no cambia de temporada");
        }
        if (!leagueSeasons.ended(edition)) {
            throw BusinessException.badRequest("La temporada de esta liga aún no ha terminado");
        }
        Competition next = leagueSeasons.currentSeason(played).orElseThrow(() -> BusinessException.badRequest(
                "La temporada nueva de " + played.getName() + " aún no está disponible"));

        League created = leagueSetupService.create(new NewLeague(old.getName(), email, next.getId(),
                edition.getPoolFormat(), edition.isPichichi(), null, null), setup(old, edition, next));
        created.setPreviousLeagueId(old.getId());
        created = leagueRepository.save(created);
        int members = copyMembers(old, created, admin);
        profileImageService.copyLeagueImage(old, created);

        log.info("Liga {} repetida como {} para la temporada {} de {} con {} miembros más", old.getId(),
                created.getId(), next.getSeason(), next.getName(), members);
        eventPublisher.publishEvent(new LeagueRepeatedEvent(created.getId(), admin.getId(), next.getSeason()));
        return created;
    }

    /**
     * Los miembros de la liga vieja entran en la nueva sin pasar por el código de invitación. Solo ellos:
     * nadie más ve la liga nueva. Su cuota vuelve a estar pendiente.
     */
    private int copyMembers(League old, League created, UserAccount admin) {
        List<Membership> members = new ArrayList<>();
        for (Membership member : membershipRepository.findByLeagueId(old.getId())) {
            UserAccount user = member.getUser();
            if (user == null || user.getId().equals(admin.getId())) continue;
            members.add(Membership.builder()
                    .id(new Membership.MembershipId(user.getId(), created.getId()))
                    .user(user)
                    .league(created)
                    .role("MEMBER")
                    .build());
        }
        membershipRepository.saveAll(members);
        return members.size();
    }

    /** Los ajustes de la liga vieja, tal como los pediría su administrador al crear la nueva. */
    private LeagueSetup setup(League old, Edition edition, Competition next) {
        PredictionLockMode lockMode = edition.getLockMode();
        // Una fecha de cierre era de la temporada pasada, y la Fórmula 1 siempre cierra en la clasificación:
        // en los dos casos la liga nueva se queda con el cierre que le toca por defecto.
        boolean keepsLock = lockMode != null && lockMode != PredictionLockMode.FIXED_DATE
                && !PoolFormat.isRaceBased(edition.getPoolFormat());
        // Siempre las de la liga vieja, aunque no las tuviera guardadas: no las de por defecto de hoy.
        ScoringRuleSet scoring = ScoringRuleSet.forEdition(edition);
        return new LeagueSetup(old.getRules(), old.isEntryFee() ? Boolean.TRUE : null, scoring,
                keepsLock ? lockMode : null, keepsLock ? edition.getLockOffsetMinutes() : null, null,
                matchSelection(edition, next));
    }

    /**
     * Qué partidos entran, con lo que se puede llevar a otra temporada: los torneos de tenis que sigue, las
     * partes de la cartelera de la UFC, las competiciones que junta y los equipos seguidos que siguen en
     * ellas. Los partidos añadidos o quitados a mano eran de la temporada pasada y no se llevan.
     */
    private MatchSelectionRequest matchSelection(Edition edition, Competition next) {
        if (edition.getPoolFormat() != PoolFormat.MATCH_DAY) return null;
        List<app.porrapp.model.CardSegment> segments = edition.getCardSegments() == null ? null
                : List.copyOf(edition.getCardSegments());
        if (edition.getTennisScope() != null) {
            return new MatchSelectionRequest(MatchSelectionMode.ALL, null, null, null, null, null, null,
                    edition.getTennisScope(), edition.getTennisTour());
        }
        List<Long> competitionIds = new ArrayList<>(List.of(next.getId()));
        for (Competition other : leagueSeasons.competitions(edition)) {
            if (other.getId().equals(edition.getCompetition().getId())) continue;
            leagueSeasons.currentSeason(other).map(Competition::getId)
                    .filter(id -> !competitionIds.contains(id)).ifPresent(competitionIds::add);
        }
        if (edition.getMatchSelection() == MatchSelectionMode.CUSTOM) {
            List<Long> teams = followedTeams(edition, competitionIds);
            // Sin ningún equipo que seguir, la liga nueva empieza con todos los partidos de su competición.
            if (teams.isEmpty()) return null;
            return new MatchSelectionRequest(MatchSelectionMode.CUSTOM, teams, null, null, competitionIds,
                    null, null, null, null);
        }
        // Con todos los partidos de una sola competición no hay nada que elegir: vale la liga recién creada.
        if (competitionIds.size() == 1 && edition.getEventSeries() == null && segments == null) return null;
        return new MatchSelectionRequest(MatchSelectionMode.ALL, null, null, null, competitionIds,
                edition.getEventSeries(), segments, null, null);
    }

    /** Los equipos que seguía la liga y que juegan la temporada nueva (un descendido ya no está). */
    private List<Long> followedTeams(Edition edition, List<Long> competitionIds) {
        Set<Long> playing = new HashSet<>();
        for (Long competitionId : competitionIds) {
            for (Match match : matchRepository.findByCompetitionId(competitionId)) {
                if (match.getHomeTeam() != null) playing.add(match.getHomeTeam().getId());
                if (match.getAwayTeam() != null) playing.add(match.getAwayTeam().getId());
            }
        }
        return followedTeamRepository.findTeamIds(edition.getId()).stream().filter(playing::contains).toList();
    }
}
