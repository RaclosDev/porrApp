package com.porra.mundial.service;

import com.porra.mundial.exception.BusinessException;
import java.util.Map;
import com.porra.mundial.dto.GroupMemberDTO;
import com.porra.mundial.dto.GroupResponseDTO;
import com.porra.mundial.repository.MatchRepository;
import com.porra.mundial.repository.TeamRepository;
import com.porra.mundial.model.Prediction;
import com.porra.mundial.model.League;
import com.porra.mundial.repository.LeagueRepository;
import com.porra.mundial.repository.PredictionRepository;
import com.porra.mundial.repository.UserAccountRepository;
import com.porra.mundial.repository.CompetitionRepository;
import com.porra.mundial.repository.EditionRepository;
import com.porra.mundial.repository.MembershipRepository;
import com.porra.mundial.model.UserAccount;
import com.porra.mundial.model.Competition;
import com.porra.mundial.model.Edition;
import com.porra.mundial.model.Membership;
import com.porra.mundial.util.JoinCodeGenerator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.ArrayList;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.stream.Collectors;


/** Ligas: creación, invitaciones, miembros, pagos y abandono. */
@Service
@RequiredArgsConstructor
@Slf4j
public class GroupService {

    private final LeagueRepository leagueRepository;
    private final PredictionRepository predictionRepository;
    private final UserAccountRepository userAccountRepository;
    private final CompetitionRepository competitionRepository;
    private final EditionRepository editionRepository;
    private final MembershipRepository membershipRepository;
    private final MatchRepository matchRepository;
    private final TeamRepository teamRepository;
    private final ApplicationEventPublisher eventPublisher;
    private final LeaguePaymentService paymentService;

    @Transactional
    @org.springframework.cache.annotation.CacheEvict(value = {"userGroups", "groupById", "groupByCode", "leaderboard"}, allEntries = true)
    public League createGroup(String name, String email, Long competitionId, com.porra.mundial.model.PoolFormat poolFormat) {
        return createGroup(name, email, competitionId, poolFormat, true);
    }

    @Transactional
    @org.springframework.cache.annotation.CacheEvict(value = {"userGroups", "groupById", "groupByCode", "leaderboard"}, allEntries = true)
    public League createGroup(String name, String email, Long competitionId, com.porra.mundial.model.PoolFormat poolFormat, boolean pichichi) {
        return createGroup(name, email, competitionId, poolFormat, pichichi, null);
    }

    @Transactional
    @org.springframework.cache.annotation.CacheEvict(value = {"userGroups", "groupById", "groupByCode", "leaderboard"}, allEntries = true)
    public League createGroup(String name, String email, Long competitionId, com.porra.mundial.model.PoolFormat poolFormat, boolean pichichi, String customCompetitionName) {
        boolean custom = customCompetitionName != null && !customCompetitionName.isBlank();
        if (custom == (competitionId != null)) {
            throw BusinessException.badRequest("Elige una competición existente o indica una nueva");
        }
        if (custom && (customCompetitionName.trim().length() > 100 || poolFormat == null)) {
            throw BusinessException.badRequest("La competición personalizada requiere un formato y un nombre de hasta 100 caracteres");
        }
        String joinCode;
        do {
            joinCode = JoinCodeGenerator.next();
        } while (leagueRepository.findByJoinCode(joinCode).isPresent());

        UserAccount adminUser = userAccountRepository.findByGoogleEmail(email)
                .orElseThrow(() -> BusinessException.notFound("Usuario no encontrado"));

        // Proteccion contra doble-click / peticiones concurrentes duplicadas
        List<League> existingLeagues = leagueRepository.findByNameAndAdminUser(name, adminUser);
        if (existingLeagues != null && !existingLeagues.isEmpty()) {
            League latest = existingLeagues.get(existingLeagues.size() - 1);
            if (latest.getCreatedAt() != null &&
                    Math.abs(java.time.Duration.between(latest.getCreatedAt(), LocalDateTime.now()).getSeconds()) < 10) {
                log.info("Doble peticion detectada para crear liga '{}' por usuario {}. Reutilizando liga existente.", name, email);
                return latest;
            }
        }

        Competition comp = null;
        if (!custom) {
            comp = competitionRepository.findById(competitionId)
                    .orElseThrow(() -> BusinessException.notFound("Competición no encontrada"));
            if (comp.getOwnerLeague() != null) {
                throw BusinessException.forbidden("Esta competición pertenece a otra liga");
            }
            comp = resolveCanonicalCompetition(comp);
        }

        League group = League.builder()
                .name(name)
                .joinCode(joinCode)
                .adminUser(adminUser)
                .build();
        group = leagueRepository.save(group);

        if (custom) {
            comp = competitionRepository.save(Competition.builder()
                    .name(customCompetitionName.trim())
                    .formatType(poolFormat == com.porra.mundial.model.PoolFormat.MATCH_DAY ? "LEAGUE" : "TOURNAMENT")
                    .ownerLeague(group)
                    .build());
        }

        Membership.MembershipId memId = new Membership.MembershipId(adminUser.getId(), group.getId());
        membershipRepository.save(Membership.builder()
                .id(memId)
                .user(adminUser)
                .league(group)
                .role("ADMIN")
                .build());

        editionRepository.save(Edition.builder()
                .league(group)
                .competition(comp)
                .poolFormat(poolFormat != null ? poolFormat : com.porra.mundial.model.PoolFormat.FULL_BRACKET)
                .lockDate(Edition.defaultLockDate(comp, poolFormat))
                .pichichi(!custom && pichichi)
                .status("ACTIVE")
                .scoringRulesJson(com.porra.mundial.scoring.ScoringRuleSet.defaultWorldCup2026().toJson())
                .build());

        if (comp.getExternalId() != null && !comp.getExternalId().isBlank()
                && matchRepository.countByCompetitionId(comp.getId()) == 0) {
            // Se importa tras confirmar la liga: si ESPN falla, la liga ya está creada.
            eventPublisher.publishEvent(new CompetitionImportRequestedEvent(comp.getId()));
        }

        return group;
    }

    /**
     * Traduce competiciones legacy (sin externalId) a su equivalente canónica con
     * proveedor de datos, para que la importación automática siempre funcione.
     */
    private Competition resolveCanonicalCompetition(Competition comp) {
        if (comp.getExternalId() != null && !comp.getExternalId().isBlank()) {
            return comp;
        }
        String name = comp.getName() != null ? comp.getName().toLowerCase(java.util.Locale.ROOT) : "";
        String slug = null;
        if (name.contains("champions")) {
            slug = "uefa.champions";
        } else if (name.contains("premier")) {
            slug = "eng.1";
        } else if (name.contains("laliga") || name.contains("la liga")) {
            slug = "esp.1";
        } else if (name.contains("mundial") || name.contains("world cup")) {
            slug = Competition.WORLD_CUP_EXTERNAL_ID;
        }
        if (slug == null) {
            return comp;
        }
        return competitionRepository.findByExternalId(slug).orElse(comp);
    }
    
    @Transactional
    @org.springframework.cache.annotation.CacheEvict(value = {"userGroups", "groupById", "groupByCode", "leaderboard"}, allEntries = true)
    public void joinGroupMembership(Long groupId, String email) {
        UserAccount user = userAccountRepository.findByGoogleEmail(email).orElse(null);
        if (user == null) return;
        
        League group = leagueRepository.findById(groupId).orElse(null);
        if (group == null) return;

        Membership.MembershipId memId = new Membership.MembershipId(user.getId(), group.getId());
        if (!membershipRepository.existsById(memId)) {
            membershipRepository.save(Membership.builder()
                    .id(memId)
                    .user(user)
                    .league(group)
                    .role("MEMBER")
                    .build());
            // Se avisa a los demás miembros tras confirmar el alta (MemberJoinedNotifier).
            eventPublisher.publishEvent(new MemberJoinedLeagueEvent(group.getId(), user.getId()));
        }
    }

    @Transactional
    @org.springframework.cache.annotation.CacheEvict(value = {"userGroups", "groupById", "groupByCode", "leaderboard"}, allEntries = true)
    public League updateGroup(Long groupId, String newName, String newRules, String email) {
        verifyGroupAdmin(groupId, email);
        League group = leagueRepository.findById(groupId)
                .orElseThrow(() -> BusinessException.notFound("Liga no encontrada"));

        boolean changed = false;

        if (newName != null) {
            if (newName.trim().isEmpty()) {
                throw BusinessException.badRequest("El nombre no puede estar vacío");
            }
            group.setName(newName.trim());
            changed = true;
        }

        if (newRules != null) {
            group.setRules(newRules.trim());
            changed = true;
        }

        if (!changed) {
            throw BusinessException.badRequest("No hay cambios que guardar");
        }

        return leagueRepository.save(group);
    }

    @Transactional
    @org.springframework.cache.annotation.CacheEvict(value = {"userGroups", "groupById", "groupByCode", "leaderboard"}, allEntries = true)
    public void deleteGroup(Long groupId, String email) {
        verifyGroupAdmin(groupId, email);
        
        List<Prediction> predictions = predictionRepository.findByEditionLeagueId(groupId);
        predictionRepository.deleteAll(predictions);
        predictionRepository.flush();
        
        List<Edition> editions = editionRepository.findByLeagueId(groupId);
        editionRepository.deleteAll(editions);
        editionRepository.flush();

        editions.stream().map(Edition::getCompetition).filter(c -> c.getOwnerLeague() != null
                && groupId.equals(c.getOwnerLeague().getId())).forEach(c -> {
            matchRepository.deleteAll(matchRepository.findByCompetitionId(c.getId()));
            matchRepository.flush();
            teamRepository.deleteAll(teamRepository.findByCompetitionIdOrderByNameAsc(c.getId()));
            teamRepository.flush();
            competitionRepository.delete(c);
        });

        competitionRepository.flush();
        
        List<Membership> memberships = membershipRepository.findByLeagueId(groupId);
        membershipRepository.deleteAll(memberships);
        
        leagueRepository.deleteById(groupId);
    }

    // Solo se cachean los aciertos: un código inexistente no debe quedarse en memoria
    // (ni hacer crecer la caché con cada intento) ni ocultar una liga creada después.
    @org.springframework.cache.annotation.Cacheable(value = "groupByCode", key = "#joinCode", unless = "#result == null")
    public Optional<League> getGroupByJoinCode(String joinCode) {
        return leagueRepository.findByJoinCode(joinCode);
    }

    /**
     * @param email Email del usuario
     * @return Las ligas donde está jugando.
     */
    @Transactional(readOnly = true)
    public List<League> getUserGroups(String email) {
        UserAccount user = userAccountRepository.findByGoogleEmail(email).orElse(null);
        if (user == null) return List.of();
        
        List<Membership> memberships = membershipRepository.findByUserId(user.getId());

        List<Long> groupIds = memberships.stream()
                .map(m -> m.getId().getLeagueId())
                .distinct()
                .collect(Collectors.toList());

        return leagueRepository.findAllById(groupIds);
    }

    /**
     * @return DTOs planos para pasarlos al JSON (API).
     */
    @Transactional(readOnly = true)
    @org.springframework.cache.annotation.Cacheable(value = "userGroups", key = "#email")
    public List<GroupResponseDTO> getUserGroupDTOs(String email) {
        List<League> groups = getUserGroups(email);
        if (groups.isEmpty()) return List.of();

        List<Long> groupIds = groups.stream().map(League::getId).collect(Collectors.toList());
        List<Edition> activeEditions = editionRepository.findByLeagueIdInAndStatus(groupIds, "ACTIVE");
        
        java.util.Map<Long, Edition> editionMap = activeEditions.stream()
                .collect(Collectors.toMap(e -> e.getLeague().getId(), e -> e, (e1, e2) -> e1));

        return groups.stream()
                .map(g -> GroupResponseDTO.of(g, editionMap.get(g.getId()), true))
                .collect(Collectors.toList());
    }

    /** Edición activa (la que se está jugando) de una liga. */
    @Transactional(readOnly = true)
    public Optional<Edition> findActiveEdition(Long leagueId) {
        return editionRepository.findByLeagueIdAndStatus(leagueId, "ACTIVE");
    }

    /** Liga con su edición activa; el código de invitación solo se incluye si se indica. */
    @Transactional(readOnly = true)
    public GroupResponseDTO toResponse(League league, boolean includeJoinCode) {
        Edition edition = editionRepository.findByLeagueIdAndStatus(league.getId(), "ACTIVE").orElse(null);
        return GroupResponseDTO.of(league, edition, includeJoinCode);
    }

    /**
     * Detalle de una liga. Quien no es miembro de una liga privada solo ve lo mismo que en la
     * vista previa de una invitación; solo los miembros ven el código de invitación.
     */
    @Transactional(readOnly = true)
    public Optional<GroupResponseDTO> findGroupResponse(Long id, String viewerEmail) {
        return getGroupById(id).map(league -> {
            boolean member = isUserMemberOrAdmin(id, viewerEmail);
            if (member || league.isPublicLeague()) {
                return toResponse(league, member);
            }
            return GroupResponseDTO.preview(league, editionRepository.findByLeagueIdAndStatus(id, "ACTIVE").orElse(null));
        });
    }

    /** La liga pública más antigua, que la portada y la demo enseñan. */
    @Transactional(readOnly = true)
    public Optional<GroupResponseDTO> findFeaturedGroupResponse(String viewerEmail) {
        return leagueRepository.findFirstByPublicLeagueTrueOrderByIdAsc()
                .map(league -> toResponse(league, isUserMemberOrAdmin(league.getId(), viewerEmail)));
    }

    /** Datos públicos para previsualizar una invitación sin unirse a la liga. */
    @Transactional(readOnly = true)
    public Optional<GroupResponseDTO> findInvitationPreview(String joinCode) {
        return getGroupByJoinCode(joinCode).map(league -> GroupResponseDTO.preview(
                league, editionRepository.findByLeagueIdAndStatus(league.getId(), "ACTIVE").orElse(null)));
    }

    @org.springframework.cache.annotation.Cacheable(value = "groupById", key = "#id")
    public Optional<League> getGroupById(Long id) {
        return leagueRepository.findById(id);
    }

    /**
     * Comprueba que el usuario puede ver los datos de una liga: las públicas, cualquiera;
     * el resto, solo sus miembros.
     *
     * @throws BusinessException si la liga es privada y el usuario no pertenece a ella
     */
    @Transactional(readOnly = true)
    public void assertCanView(Long groupId, String email) {
        if (groupId == null) {
            throw BusinessException.badRequest("Falta la liga");
        }
        if (leagueRepository.findById(groupId).map(League::isPublicLeague).orElse(false)) return;
        if (!isUserMemberOrAdmin(groupId, email)) {
            throw BusinessException.forbidden("No perteneces a esta liga privada");
        }
    }

    @Transactional(readOnly = true)
    public boolean isUserMemberOrAdmin(Long groupId, String email) {
        if (groupId == null || email == null || email.isBlank()) {
            return false;
        }
        UserAccount user = userAccountRepository.findByGoogleEmail(email).orElse(null);
        if (user == null) {
            return false;
        }
        Membership.MembershipId memId = new Membership.MembershipId(user.getId(), groupId);
        return membershipRepository.existsById(memId);
    }

    @Transactional
    @org.springframework.cache.annotation.CacheEvict(value = {"userGroups", "groupById", "groupByCode", "leaderboard"}, allEntries = true)
    public void leaveGroup(Long groupId, String email) {
        League group = leagueRepository.findById(groupId)
            .orElseThrow(() -> BusinessException.notFound("Liga no encontrada"));

        if (group.getAdminUser().getGoogleEmail().equalsIgnoreCase(email)) {
            throw BusinessException.badRequest("El creador de la liga no puede abandonarla.");
        }

        UserAccount user = userAccountRepository.findByGoogleEmail(email).orElse(null);
        if (user != null) {
            List<Prediction> predictions = predictionRepository.findByEditionLeagueId(groupId).stream()
                    .filter(b -> b.getUser().getId().equals(user.getId())) 
                    .collect(Collectors.toList());
            predictionRepository.deleteAll(predictions);
            
            Membership.MembershipId memId = new Membership.MembershipId(user.getId(), groupId);
            if (membershipRepository.existsById(memId)) {
                membershipRepository.deleteById(memId);
            }
        }
    }

    /** Falla si el usuario no administra la liga. */
    private void verifyGroupAdmin(Long groupId, String email) {
        League group = leagueRepository.findById(groupId)
                .orElseThrow(() -> BusinessException.notFound("Liga no encontrada"));
                               
        if (!group.getAdminUser().getGoogleEmail().equalsIgnoreCase(email)) {
            throw BusinessException.forbidden("No tienes permiso para administrar esta liga.");
        }
    }

    /**
     * Obtiene los miembros de una liga con su rol y estado de pago.
     */
    @Transactional(readOnly = true)
    public List<GroupMemberDTO> getGroupMembers(Long groupId, String email) {
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
        List<GroupMemberDTO> list = new ArrayList<>();

        for (Membership m : memberships) {
            UserAccount u = m.getUser();
            if (u == null) continue;
            boolean isAdmin = "ADMIN".equalsIgnoreCase(m.getRole())
                    || (group.getAdminUser() != null && group.getAdminUser().getId().equals(u.getId()));

            // Una liga pública la ve cualquiera: ni emails ni estado de pago.
            String displayEmail = isPublic ? null
                    : (callerIsAdmin || (email != null && email.equalsIgnoreCase(u.getGoogleEmail())))
                            ? u.getGoogleEmail()
                            : maskEmail(u.getGoogleEmail());
            String paymentStatus = isPublic ? null
                    : m.getPaymentStatus() != null ? m.getPaymentStatus() : "PENDING";

            list.add(GroupMemberDTO.builder()
                    .userId(u.getId())
                    .participantName(u.getParticipantName())
                    .googleEmail(displayEmail)
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

    private String maskEmail(String email) {
        if (email == null || !email.contains("@")) return null;
        int atIdx = email.indexOf("@");
        String name = email.substring(0, atIdx);
        String domain = email.substring(atIdx);
        if (name.length() <= 2) return name.charAt(0) + "***" + domain;
        return name.substring(0, 2) + "***" + domain;
    }

    /**
     * Cambia el estado de pago de un miembro en la liga y sincroniza su pronóstico.
     */
    @Transactional
    @org.springframework.cache.annotation.CacheEvict(value = {"leaderboard", "userGroups"}, allEntries = true)
    public void toggleMemberPayment(Long groupId, Long targetUserId, String email, String status) {
        verifyGroupAdmin(groupId, email);

        UserAccount admin = userAccountRepository.findByGoogleEmail(email)
                .orElseThrow(() -> BusinessException.notFound("Usuario no encontrado"));
        paymentService.setPayment(groupId, targetUserId, status, admin);
    }

    /**
     * Expulsa a un participante de la liga eliminando sus pronósticos y membresía.
     */
    @Transactional
    @org.springframework.cache.annotation.CacheEvict(value = {"leaderboard", "userGroups"}, allEntries = true)
    public void kickMember(Long groupId, Long targetUserId, String email) {
        verifyGroupAdmin(groupId, email);
        League group = leagueRepository.findById(groupId)
                .orElseThrow(() -> BusinessException.notFound("Liga no encontrada"));

        if (group.getAdminUser() != null && group.getAdminUser().getId().equals(targetUserId)) {
            throw BusinessException.badRequest("No puedes expulsar al administrador creador de la liga.");
        }

        List<Prediction> preds = predictionRepository.findByEditionLeagueId(groupId);
        for (Prediction p : preds) {
            if (p.getUser() != null && p.getUser().getId().equals(targetUserId)) {
                predictionRepository.delete(p);
            }
        }

        Membership.MembershipId memId = new Membership.MembershipId(targetUserId, groupId);
        membershipRepository.deleteById(memId);
    }

    /**
     * Cede la administración de la liga a otro miembro. El administrador anterior sigue como miembro.
     */
    @Transactional
    @org.springframework.cache.annotation.CacheEvict(value = {"userGroups", "groupById", "groupByCode", "leaderboard"}, allEntries = true)
    public void transferAdmin(Long groupId, Long targetUserId, String email) {
        verifyGroupAdmin(groupId, email);
        League group = leagueRepository.findById(groupId)
                .orElseThrow(() -> BusinessException.notFound("Liga no encontrada"));
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

    /**
     * Regenera el código de invitación de la liga si se ha filtrado.
     */
    @Transactional
    @org.springframework.cache.annotation.CacheEvict(value = {"userGroups", "groupById", "groupByCode", "leaderboard"}, allEntries = true)
    public String regenerateJoinCode(Long groupId, String email) {
        verifyGroupAdmin(groupId, email);
        League group = leagueRepository.findById(groupId)
                .orElseThrow(() -> BusinessException.notFound("Liga no encontrada"));

        String newCode;
        do {
            newCode = JoinCodeGenerator.next();
        } while (leagueRepository.findByJoinCode(newCode).isPresent());
        group.setJoinCode(newCode);
        leagueRepository.save(group);
        return newCode;
    }
}
