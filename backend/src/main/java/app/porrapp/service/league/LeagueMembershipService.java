package app.porrapp.service.league;

import app.porrapp.dto.LeagueMemberDTO;
import app.porrapp.exception.BusinessException;
import app.porrapp.model.League;
import app.porrapp.model.Membership;
import app.porrapp.model.UserAccount;
import app.porrapp.repository.LeagueRepository;
import app.porrapp.repository.MembershipRepository;
import app.porrapp.repository.PredictionRepository;
import app.porrapp.repository.UserAccountRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

/** Miembros de una liga: alta, baja, expulsión, pagos y cambio de administrador. */
@Service
@RequiredArgsConstructor
public class LeagueMembershipService {

    private final LeagueRepository leagueRepository;
    private final UserAccountRepository userAccountRepository;
    private final MembershipRepository membershipRepository;
    private final PredictionRepository predictionRepository;
    private final ApplicationEventPublisher eventPublisher;
    private final LeaguePaymentService paymentService;
    private final ScoreboardRoster scoreboardRoster;

    @Transactional
    // Un alta o baja solo cambia el ranking de esa liga y la lista de ligas de ese usuario: la liga
    // en sí no cambia, y vaciar la caché de todas las ligas en cada alta dispararía recálculos.
    @org.springframework.cache.annotation.Caching(evict = {
            @org.springframework.cache.annotation.CacheEvict(value = "leaderboard", key = "#groupId"),
            @org.springframework.cache.annotation.CacheEvict(value = "userGroups", key = "#email")})
    public void join(Long groupId, String email) {
        UserAccount user = userAccountRepository.findByGoogleEmail(email).orElse(null);
        if (user == null) return;
        
        League group = leagueRepository.findById(groupId).orElse(null);
        if (group == null) return;

        if (group.isPoker()) leagueRepository.findWithLockById(groupId)
                .orElseThrow(() -> BusinessException.notFound("Liga no encontrada"));
        Membership.MembershipId memId = new Membership.MembershipId(user.getId(), group.getId());
        if (!membershipRepository.existsById(memId)) {
            membershipRepository.save(Membership.builder()
                    .id(memId)
                    .user(user)
                    .league(group)
                    .role("MEMBER")
                    .build());
            if (group.isScoreboard() || group.isPoker()) scoreboardRoster.memberJoined(group, user);
            // Se avisa a los demás miembros tras confirmar el alta (MemberJoinedNotifier).
            eventPublisher.publishEvent(new MemberJoinedLeagueEvent(group.getId(), user.getId()));
        }
    }

    @Transactional
    // Una baja solo cambia el ranking de esa liga y la lista de ligas de ese usuario: la liga
    // en sí no cambia, y vaciar la caché de todas las ligas en cada baja dispararía recálculos.
    @org.springframework.cache.annotation.Caching(evict = {
            @org.springframework.cache.annotation.CacheEvict(value = "leaderboard", key = "#groupId"),
            @org.springframework.cache.annotation.CacheEvict(value = "userGroups", key = "#email")})
    public void leave(Long groupId, String email) {
        League group = leagueRepository.findById(groupId)
            .orElseThrow(() -> BusinessException.notFound("Liga no encontrada"));

        if (group.getAdminUser().getGoogleEmail().equalsIgnoreCase(email)) {
            throw BusinessException.badRequest("El creador de la liga no puede abandonarla.");
        }

        UserAccount user = userAccountRepository.findByGoogleEmail(email).orElse(null);
        if (user != null) {
            predictionRepository.deleteByUserIdAndLeagueId(user.getId(), groupId);
            if (group.isScoreboard()) scoreboardRoster.memberLeft(groupId, user.getId());

            Membership.MembershipId memId = new Membership.MembershipId(user.getId(), groupId);
            if (membershipRepository.existsById(memId)) {
                membershipRepository.deleteById(memId);
            }
        }
    }

    /**
     * Obtiene los miembros de una liga con su rol y estado de pago.
     */
    @Transactional(readOnly = true)
    public List<LeagueMemberDTO> members(Long groupId, String email) {
        League group = leagueRepository.findById(groupId)
                .orElseThrow(() -> BusinessException.notFound("Liga no encontrada"));

        boolean isPublic = group.isPublicLeague();
        boolean callerIsAdmin = false;

        if (email != null && !email.isBlank()) {
            boolean isLeagueAdmin = group.getAdminUser() != null && group.getAdminUser().getGoogleEmail() != null && group.getAdminUser().getGoogleEmail().equalsIgnoreCase(email);
            callerIsAdmin = isLeagueAdmin;
            if (!callerIsAdmin && !isPublic) {
                UserAccount caller = userAccountRepository.findByGoogleEmail(email).orElse(null);
                if (caller == null || !membershipRepository.existsById(new Membership.MembershipId(caller.getId(), groupId))) {
                    throw BusinessException.forbidden("No perteneces a esta liga privada.");
                }
            }
        } else if (!isPublic) {
            throw BusinessException.forbidden("No autenticado para consultar miembros de una liga privada.");
        }

        List<Membership> memberships = membershipRepository.findByLeagueId(groupId);
        List<LeagueMemberDTO> list = new ArrayList<>();

        for (Membership m : memberships) {
            UserAccount u = m.getUser();
            if (u == null) continue;
            boolean isAdmin = "ADMIN".equalsIgnoreCase(m.getRole())
                    || (group.getAdminUser() != null && group.getAdminUser().getId().equals(u.getId()));

            // Nunca se envía el email de nadie; una liga pública o sin cuota no muestra pagos.
            String paymentStatus = isPublic || !group.isEntryFee() ? null
                    : m.getPaymentStatus() != null ? m.getPaymentStatus() : "PENDING";

            list.add(LeagueMemberDTO.builder()
                    .userId(u.getId())
                    .participantName(u.getParticipantName())
                    .role(m.getRole())
                    .paymentStatus(paymentStatus)
                    .joinedAt(m.getJoinedAt())
                    .admin(isAdmin)
                    .avatarUrl(u.getAvatarUrl())
                    .build());
        }

        list.sort((a, b) -> {
            if (a.isAdmin() != b.isAdmin()) return a.isAdmin() ? -1 : 1;
            return a.getParticipantName().compareToIgnoreCase(b.getParticipantName());
        });

        return list;
    }

    /**
     * Cambia el estado de pago de un miembro en la liga y sincroniza su pronóstico.
     */
    @Transactional
    @org.springframework.cache.annotation.CacheEvict(value = "leaderboard", key = "#groupId")
    public void setPayment(Long groupId, Long targetUserId, String email, String status) {
        LeagueAdmins.require(leagueRepository, groupId, email);

        UserAccount admin = userAccountRepository.findByGoogleEmail(email)
                .orElseThrow(() -> BusinessException.notFound("Usuario no encontrado"));
        paymentService.setPayment(groupId, targetUserId, status, admin);
    }

    /**
     * Expulsa a un participante de la liga eliminando sus pronósticos y membresía.
     */
    @Transactional
    // La lista de ligas del expulsado se indexa por su email, que no llega aquí; las expulsiones son raras.
    @org.springframework.cache.annotation.Caching(evict = {
            @org.springframework.cache.annotation.CacheEvict(value = "leaderboard", key = "#groupId"),
            @org.springframework.cache.annotation.CacheEvict(value = "userGroups", allEntries = true)})
    public void kick(Long groupId, Long targetUserId, String email) {
        League group = LeagueAdmins.require(leagueRepository, groupId, email);

        if (group.getAdminUser() != null && group.getAdminUser().getId().equals(targetUserId)) {
            throw BusinessException.badRequest("No puedes expulsar al administrador creador de la liga.");
        }

        predictionRepository.deleteByUserIdAndLeagueId(targetUserId, groupId);
        if (group.isScoreboard()) scoreboardRoster.memberLeft(groupId, targetUserId);

        Membership.MembershipId memId = new Membership.MembershipId(targetUserId, groupId);
        membershipRepository.deleteById(memId);
    }

    /**
     * Cede la administración de la liga a otro miembro. El administrador anterior sigue como miembro.
     */
    @Transactional
    @org.springframework.cache.annotation.CacheEvict(value = {"userGroups", "groupById", "groupByCode", "leaderboard"}, allEntries = true)
    public void transferAdmin(Long groupId, Long targetUserId, String email) {
        League group = LeagueAdmins.require(leagueRepository, groupId, email);
        UserAccount currentAdmin = group.getAdminUser();
        if (currentAdmin.getId().equals(targetUserId)) {
            throw BusinessException.badRequest("Ya administras esta liga.");
        }

        Membership target = membershipRepository.findById(new Membership.MembershipId(targetUserId, groupId))
                .orElseThrow(() -> BusinessException.badRequest("Solo puedes ceder la liga a uno de sus miembros."));
        target.setRole("ADMIN");
        membershipRepository.findById(new Membership.MembershipId(currentAdmin.getId(), groupId))
                .ifPresent(m -> m.setRole("MEMBER"));
        group.setAdminUser(target.getUser());
    }
}
