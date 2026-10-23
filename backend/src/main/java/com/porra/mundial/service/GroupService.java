package com.porra.mundial.service;

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
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 *  Servicio de Grupos/Ligas (GroupService).
 * Maneja la creación de ligas privadas, invitar amigos con códigos (Join Code),
 * nombrar administradores y borrar o abandonar ligas.
 */
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

    @Value("${app.admins:Admin}")
    private List<String> appAdmins;

    /**
     * Script de inicialización que corre al arrancar el backend.
     * Crea automáticamente la "Porra Global" oficial si no existe,
     * para asegurar que los usuarios sin grupo puedan participar en algo.
     */
    @PostConstruct
    @Transactional
    public void initDefaultGroup() {
        UserAccount adminUser = userAccountRepository.findByParticipantName("Admin")
                .orElseGet(() -> userAccountRepository.save(UserAccount.builder()
                        .googleEmail("admin@local")
                        .googleName("Admin")
                        .participantName("Admin")
                        .isSuperadmin(true)
                        .build()));

        League globalGroup = leagueRepository.findById(1L).orElse(null);

        if (globalGroup == null) {
            // Find if any group has code GLOBAL
            globalGroup = leagueRepository.findByJoinCode("GLOBAL").orElse(null);
            if (globalGroup == null) {
                globalGroup = League.builder()
                        .name("Porra Global")
                        .joinCode("GLOBAL")
                        .adminUser(adminUser)
                        .build();
                globalGroup = leagueRepository.save(globalGroup);
            }
        } else {
            // Ensure group 1 is named "Porra Global", has joinCode "GLOBAL", and admin is "Admin"
            if (!"GLOBAL".equals(globalGroup.getJoinCode()) || !"Porra Global".equals(globalGroup.getName()) || !adminUser.getId().equals(globalGroup.getAdminUser().getId())) {
                try {
                    // If there's another group with join code GLOBAL, we rename it first to avoid unique constraint violation
                    leagueRepository.findByJoinCode("GLOBAL").ifPresent(other -> {
                        if (!other.getId().equals(1L)) {
                            log.warn("Found another group with code GLOBAL: id={}. Renaming it to avoid conflict.", other.getId());
                            other.setJoinCode(UUID.randomUUID().toString().substring(0, 6).toUpperCase());
                            leagueRepository.saveAndFlush(other);
                        }
                    });
                    
                    log.info("Updating existing group 1 to be the Global group (joinCode=GLOBAL, name=Porra Global, adminUser=Admin)");
                    globalGroup.setJoinCode("GLOBAL");
                    globalGroup.setName("Porra Global");
                    globalGroup.setAdminUser(adminUser);
                    globalGroup = leagueRepository.saveAndFlush(globalGroup);
                } catch (Exception e) {
                    log.error("Failed to update global group, likely due to DB constraints. Error: {}", e.getMessage(), e);
                }
            }
        }

        final League finalGlobalGroup = globalGroup;

        // Ensure Competition exists
        Competition comp = competitionRepository.findByName("Mundial 2026")
            .orElseGet(() -> competitionRepository.save(Competition.builder()
                    .name("Mundial 2026")
                    .build()));

        // Ensure Edition exists
        Edition edition = editionRepository.findByLeagueIdAndStatus(finalGlobalGroup.getId(), "ACTIVE")
            .orElseGet(() -> editionRepository.save(Edition.builder()
                    .league(finalGlobalGroup)
                    .competition(comp)
                    .poolFormat(com.porra.mundial.model.PoolFormat.FULL_BRACKET)
                    .status("ACTIVE")
                    .build()));

        // Ensure Membership for Admin
        Membership.MembershipId memId = new Membership.MembershipId(finalGlobalGroup.getAdminUser().getId(), finalGlobalGroup.getId());
        if (!membershipRepository.existsById(memId)) {
            membershipRepository.save(Membership.builder()
                .id(memId)
                .user(finalGlobalGroup.getAdminUser())
                .league(finalGlobalGroup)
                .role("ADMIN")
                .build());
        }

        // Migrate all existing predictions to this global group (except the Admin template)
        List<Prediction> allPredictions = predictionRepository.findAll();
        boolean migrated = false;
        for (Prediction pred : allPredictions) {
            if (pred.getEdition() == null) {
                if (pred.getParticipantName() != null && pred.getParticipantName().equalsIgnoreCase("Admin")) {
                    // Admin prediction stays global (null)
                    continue;
                }
                pred.setEdition(edition);
                predictionRepository.save(pred);
                migrated = true;
            }
        }
        
        if (migrated) {
            log.info("Migrados los pronosticos existentes al Grupo Global.");
        }
    }

    /**
     * Crea un nuevo grupo privado.
     * @param name Nombre elegido para el grupo.
     * @param email Email del creador (pasará a ser Admin del grupo).
     * @param competitionId Competición asociada (ej. Mundial 2026).
     * @param betMode Modo de la porra (Brackets o Fase de Grupos).
     */
    @Transactional
    @org.springframework.cache.annotation.CacheEvict(value = {"userGroups", "groupById", "groupByCode", "groupResponse"}, allEntries = true)
    public League createGroup(String name, String email, Long competitionId, com.porra.mundial.model.BetMode betMode) {
        return createGroup(name, email, competitionId, betMode != null ? betMode.toPoolFormat() : com.porra.mundial.model.PoolFormat.FULL_BRACKET, true);
    }

    @Transactional
    @org.springframework.cache.annotation.CacheEvict(value = {"userGroups", "groupById", "groupByCode", "groupResponse"}, allEntries = true)
    public League createGroup(String name, String email, Long competitionId, com.porra.mundial.model.PoolFormat poolFormat) {
        return createGroup(name, email, competitionId, poolFormat, true);
    }

    @Transactional
    @org.springframework.cache.annotation.CacheEvict(value = {"userGroups", "groupById", "groupByCode", "groupResponse"}, allEntries = true)
    public League createGroup(String name, String email, Long competitionId, com.porra.mundial.model.BetMode betMode, boolean pichichi) {
        return createGroup(name, email, competitionId, betMode != null ? betMode.toPoolFormat() : com.porra.mundial.model.PoolFormat.FULL_BRACKET, pichichi);
    }

    /**
     * Sobrecarga de creación de grupo para especificar si la predicción de Pichichi está activa.
     */
    @Transactional
    @org.springframework.cache.annotation.CacheEvict(value = {"userGroups", "groupById", "groupByCode", "groupResponse"}, allEntries = true)
    public League createGroup(String name, String email, Long competitionId, com.porra.mundial.model.PoolFormat poolFormat, boolean pichichi) {
        String joinCode;
        // Genera un código de 6 caracteres aleatorio
        do {
            joinCode = UUID.randomUUID().toString().substring(0, 6).toUpperCase();
        } while (leagueRepository.findByJoinCode(joinCode).isPresent());

        UserAccount adminUser = userAccountRepository.findByGoogleEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado por email: " + email));

        Competition comp = competitionRepository.findById(competitionId)
                .orElseThrow(() -> new IllegalArgumentException("Competición no encontrada"));

        League group = League.builder()
                .name(name)
                .joinCode(joinCode)
                .adminUser(adminUser)
                .build();
        group = leagueRepository.save(group);

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
                .pichichi(pichichi)
                .status("ACTIVE")
                .build());

        return group;
    }
    
    /**
     * Vincula a un usuario (Miembro) con un Grupo a través del JoinCode.
     */
    @Transactional
    @org.springframework.cache.annotation.CacheEvict(value = {"userGroups", "groupById", "groupByCode", "groupResponse"}, allEntries = true)
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
        }
    }

    /**
     * Permite a un Admin renombrar su propia liga.
     */
    @Transactional
    @org.springframework.cache.annotation.CacheEvict(value = {"userGroups", "groupById", "groupByCode", "groupResponse"}, allEntries = true)
    public League updateGroupName(Long groupId, String newName, String email) {
        verifyGroupAdmin(groupId, email);
        if (newName == null || newName.trim().isEmpty()) {
            throw new IllegalArgumentException("El nombre no puede estar vacío");
        }
        League group = leagueRepository.findById(groupId)
                .orElseThrow(() -> new java.util.NoSuchElementException("Grupo no encontrado"));
        group.setName(newName.trim());
        return leagueRepository.save(group);
    }

    /**
     * Permite a un Admin eliminar toda la liga, incluyendo usuarios, membresías y apuestas dentro.
     */
    @Transactional
    @org.springframework.cache.annotation.CacheEvict(value = {"userGroups", "groupById", "groupByCode", "groupResponse"}, allEntries = true)
    public void deleteGroup(Long groupId, String email) {
        verifyGroupAdmin(groupId, email);
        
        List<Prediction> predictions = predictionRepository.findByEditionLeagueId(groupId);
        predictionRepository.deleteAll(predictions);
        
        List<Edition> editions = editionRepository.findByLeagueId(groupId);
        editionRepository.deleteAll(editions);
        
        List<Membership> memberships = membershipRepository.findByLeagueId(groupId);
        membershipRepository.deleteAll(memberships);
        
        leagueRepository.deleteById(groupId);
    }

    @org.springframework.cache.annotation.Cacheable(value = "groupByCode", key = "#joinCode")
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
    public List<com.porra.mundial.dto.GroupResponseDTO> getUserGroupDTOs(String email) {
        List<League> groups = getUserGroups(email);
        if (groups.isEmpty()) return List.of();

        List<Long> groupIds = groups.stream().map(League::getId).collect(Collectors.toList());
        List<Edition> activeEditions = editionRepository.findByLeagueIdInAndStatus(groupIds, "ACTIVE");
        
        java.util.Map<Long, Edition> editionMap = activeEditions.stream()
                .collect(Collectors.toMap(e -> e.getLeague().getId(), e -> e));

        return groups.stream().map(g -> {
            Edition e = editionMap.get(g.getId());
            return com.porra.mundial.dto.GroupResponseDTO.builder()
                    .id(g.getId())
                    .name(g.getName())
                    .joinCode(g.getJoinCode())
                    .adminParticipantName(g.getAdminParticipantName())
                    .adminUserId(g.getAdminUserId())
                    .createdAt(g.getCreatedAt())
                    .competitionId(e != null && e.getCompetition() != null ? e.getCompetition().getId() : null)
                    .competitionName(e != null && e.getCompetition() != null ? e.getCompetition().getName() : null)
                    .betMode(e != null && e.getPoolFormat() != null ? e.getPoolFormat().name() : null)
                    .poolFormat(e != null && e.getPoolFormat() != null ? e.getPoolFormat().name() : null)
                    .pichichi(e != null ? e.isPichichi() : null)
                    .lockDate(e != null ? e.getLockDate() : null)
                    .isLocked(e != null && e.isLocked())
                    .build();
        }).collect(Collectors.toList());
    }

    @org.springframework.cache.annotation.Cacheable(value = "groupById", key = "#id")
    public Optional<League> getGroupById(Long id) {
        return leagueRepository.findById(id);
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
        if (user.isSuperadmin()) {
            return true;
        }
        Membership.MembershipId memId = new Membership.MembershipId(user.getId(), groupId);
        return membershipRepository.existsById(memId);
    }

    /**
     * Permite a un miembro normal (No-Admin) abandonar la liga por su cuenta.
     */
    @Transactional
    @org.springframework.cache.annotation.CacheEvict(value = {"userGroups", "groupById", "groupByCode", "groupResponse"}, allEntries = true)
    public void leaveGroup(Long groupId, String email) {
        League group = leagueRepository.findById(groupId)
            .orElseThrow(() -> new java.util.NoSuchElementException("Grupo no encontrado"));

        if (group.getAdminUser().getGoogleEmail().equalsIgnoreCase(email)) {
            throw new IllegalArgumentException("El creador de la liga no puede abandonarla.");
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

    /**
     * Middleware de seguridad para comprobar si eres Admin antes de ejecutar acciones criticas.
     */
    private void verifyGroupAdmin(Long groupId, String email) {
        League group = leagueRepository.findById(groupId)
                .orElseThrow(() -> new java.util.NoSuchElementException("Grupo no encontrado"));
                               
        if (!group.getAdminUser().getGoogleEmail().equalsIgnoreCase(email)) {
            throw new SecurityException("No tienes permiso para administrar esta liga.");
        }
    }

    @Transactional(readOnly = true)
    public List<Prediction> getGroupPredictionsForAdmin(Long groupId, String email) {
        verifyGroupAdmin(groupId, email);
        return predictionRepository.findByEditionLeagueId(groupId);
    }

    @Transactional(readOnly = true)
    public List<Prediction> getGroupBetsForAdmin(Long groupId, String email) {
        return getGroupPredictionsForAdmin(groupId, email);
    }

    /**
     * Cambiar el estado de pago de un pronostico concreto dentro del grupo.
     */
    @Transactional
    @org.springframework.cache.annotation.CacheEvict(value = {"leaderboard", "userGroups", "allBetsDto", "myBetsDto", "rebuiltBetData"}, allEntries = true)
    public Prediction togglePredictionPaymentStatus(Long groupId, Long predictionId, String email, boolean paid) {
        verifyGroupAdmin(groupId, email);
        Prediction pred = predictionRepository.findById(predictionId)
                .orElseThrow(() -> new java.util.NoSuchElementException("Pronostico no encontrado"));
        if (!groupId.equals(pred.getGroupId())) {
            throw new IllegalArgumentException("El pronostico no pertenece a este grupo");
        }
        pred.setPaid(paid);
        return predictionRepository.save(pred);
    }

    @Transactional
    @org.springframework.cache.annotation.CacheEvict(value = {"leaderboard", "userGroups", "allBetsDto", "myBetsDto", "rebuiltBetData"}, allEntries = true)
    public Prediction toggleBetPaymentStatus(Long groupId, Long betId, String email, boolean paid) {
        return togglePredictionPaymentStatus(groupId, betId, email, paid);
    }

    @Transactional
    @org.springframework.cache.annotation.CacheEvict(value = {"leaderboard", "userGroups", "allBetsDto", "myBetsDto", "rebuiltBetData"}, allEntries = true)
    public void deletePrediction(Long groupId, Long predictionId, String email) {
        verifyGroupAdmin(groupId, email);
        Prediction pred = predictionRepository.findById(predictionId)
                .orElseThrow(() -> new java.util.NoSuchElementException("Pronostico no encontrado"));
        if (!groupId.equals(pred.getGroupId())) {
            throw new IllegalArgumentException("El pronostico no pertenece a este grupo");
        }
        predictionRepository.delete(pred);
    }

    @Transactional
    @org.springframework.cache.annotation.CacheEvict(value = {"leaderboard", "userGroups", "allBetsDto", "myBetsDto", "rebuiltBetData"}, allEntries = true)
    public void deleteBet(Long groupId, Long betId, String email) {
        deletePrediction(groupId, betId, email);
    }

}
