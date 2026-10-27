package com.porra.mundial.service;

import java.util.Map;
import java.util.LinkedHashMap;
import java.util.Objects;
import java.util.Set;
import com.porra.mundial.dto.GroupMemberDTO;
import com.porra.mundial.dto.MissingUserNudgeDTO;
import com.porra.mundial.model.Match;
import com.porra.mundial.repository.MatchRepository;
import com.porra.mundial.repository.MatchPredictionRepository;
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
import java.util.ArrayList;
import java.time.LocalDateTime;
import com.porra.mundial.model.MatchPrediction;
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
    private final MatchRepository matchRepository;
    private final MatchPredictionRepository matchPredictionRepository;
    @org.springframework.context.annotation.Lazy
    private final SyncService syncService;

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

        // Ensure competition exists (siempre la canónica con proveedor externo)
        Competition comp = competitionRepository.findByExternalId("fifa.world")
            .or(() -> competitionRepository.findByName("FIFA World Cup 2026"))
            .orElseGet(() -> competitionRepository.save(Competition.builder()
                    .name("FIFA World Cup 2026")
                    .externalId("fifa.world")
                    .formatType("TOURNAMENT")
                    .build()));

        // Ensure Edition exists
        Edition edition = editionRepository.findByLeagueIdAndStatus(finalGlobalGroup.getId(), "ACTIVE")
            .orElseGet(() -> editionRepository.save(Edition.builder()
                    .league(finalGlobalGroup)
                    .competition(comp)
                    .poolFormat(com.porra.mundial.model.PoolFormat.FULL_BRACKET)
                    .pichichi(true)
                    .status("ACTIVE")
                    .build()));
        if (!edition.isPichichi()) {
            edition.setPichichi(true);
            editionRepository.save(edition);
        }

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
    @org.springframework.cache.annotation.CacheEvict(value = {"leaderboard", "userGroups", "groupById", "groupByCode", "groupResponse", "allBetsDto", "allPredictionsDto", "myBetsDto", "myPredictionsDto", "rebuiltBetData", "rebuiltPredictionData"}, allEntries = true)
    public League createGroup(String name, String email, Long competitionId, com.porra.mundial.model.BetMode betMode) {
        return createGroup(name, email, competitionId, betMode != null ? betMode.toPoolFormat() : com.porra.mundial.model.PoolFormat.FULL_BRACKET, true);
    }

    @Transactional
    @org.springframework.cache.annotation.CacheEvict(value = {"userGroups", "groupById", "groupByCode", "groupResponse", "leaderboard", "allPredictionsDto", "allBetsDto", "myPredictionsDto", "myBetsDto", "rebuiltBetData", "rebuiltPredictionData"}, allEntries = true)
    public League createGroup(String name, String email, Long competitionId, com.porra.mundial.model.PoolFormat poolFormat) {
        return createGroup(name, email, competitionId, poolFormat, true);
    }

    @Transactional
    @org.springframework.cache.annotation.CacheEvict(value = {"userGroups", "groupById", "groupByCode", "groupResponse", "leaderboard", "allPredictionsDto", "allBetsDto", "myPredictionsDto", "myBetsDto", "rebuiltBetData", "rebuiltPredictionData"}, allEntries = true)
    public League createGroup(String name, String email, Long competitionId, com.porra.mundial.model.BetMode betMode, boolean pichichi) {
        return createGroup(name, email, competitionId, betMode != null ? betMode.toPoolFormat() : com.porra.mundial.model.PoolFormat.FULL_BRACKET, pichichi);
    }

    /**
     * Sobrecarga de creación de grupo para especificar si la predicción de Pichichi está activa.
     */
    @Transactional
    @org.springframework.cache.annotation.CacheEvict(value = {"userGroups", "groupById", "groupByCode", "groupResponse", "leaderboard", "allPredictionsDto", "allBetsDto", "myPredictionsDto", "myBetsDto", "rebuiltBetData", "rebuiltPredictionData"}, allEntries = true)
    public League createGroup(String name, String email, Long competitionId, com.porra.mundial.model.PoolFormat poolFormat, boolean pichichi) {
        String joinCode;
        // Genera un código de 6 caracteres aleatorio
        do {
            joinCode = UUID.randomUUID().toString().substring(0, 6).toUpperCase();
        } while (leagueRepository.findByJoinCode(joinCode).isPresent());

        UserAccount adminUser = userAccountRepository.findByGoogleEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado por email: " + email));

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

        Competition comp = competitionRepository.findById(competitionId)
                .orElseThrow(() -> new IllegalArgumentException("Competición no encontrada"));
        comp = resolveCanonicalCompetition(comp);

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
                .scoringRulesJson(com.porra.mundial.scoring.ScoringRuleSet.defaultWorldCup2026().toJson())
                .build());

        if (comp.getExternalId() != null && !comp.getExternalId().isBlank()) {
            if (matchRepository.countByCompetitionId(comp.getId()) == 0) {
                try {
                    syncService.importCompetitionData(comp.getId());
                } catch (Exception e) {
                    log.warn("Auto-importación de datos para {} falló: {}", comp.getName(), e.getMessage());
                }
            }
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
            slug = "fifa.world";
        }
        if (slug == null) {
            return comp;
        }
        return competitionRepository.findByExternalId(slug).orElse(comp);
    }
    
    /**
     * Vincula a un usuario (Miembro) con un Grupo a través del JoinCode.
     */
    @Transactional
    @org.springframework.cache.annotation.CacheEvict(value = {"userGroups", "groupById", "groupByCode", "groupResponse", "leaderboard", "allPredictionsDto", "allBetsDto", "myPredictionsDto", "myBetsDto", "rebuiltBetData", "rebuiltPredictionData"}, allEntries = true)
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
    @org.springframework.cache.annotation.CacheEvict(value = {"userGroups", "groupById", "groupByCode", "groupResponse", "leaderboard", "allPredictionsDto", "allBetsDto", "myPredictionsDto", "myBetsDto", "rebuiltBetData", "rebuiltPredictionData"}, allEntries = true)
    public League updateGroup(Long groupId, String newName, String newRules, String email) {
        verifyGroupAdmin(groupId, email);
        League group = leagueRepository.findById(groupId)
                .orElseThrow(() -> new java.util.NoSuchElementException("Grupo no encontrado"));

        boolean changed = false;

        if (newName != null) {
            if (newName.trim().isEmpty()) {
                throw new IllegalArgumentException("El nombre no puede estar vacío");
            }
            group.setName(newName.trim());
            changed = true;
        }

        if (newRules != null) {
            group.setRules(newRules.trim());
            changed = true;
        }

        if (!changed) {
            throw new IllegalArgumentException("No hay cambios que guardar");
        }

        return leagueRepository.save(group);
    }

    /**
     * Permite a un Admin eliminar toda la liga, incluyendo usuarios, membresías y apuestas dentro.
     */
    @Transactional
    @org.springframework.cache.annotation.CacheEvict(value = {"userGroups", "groupById", "groupByCode", "groupResponse", "leaderboard", "allPredictionsDto", "allBetsDto", "myPredictionsDto", "myBetsDto", "rebuiltBetData", "rebuiltPredictionData"}, allEntries = true)
    @Transactional
    public League updateGroupImage(Long groupId, String imageData, String email) {
        verifyGroupAdmin(groupId, email);
        if (imageData != null && !imageData.isBlank() && (!imageData.matches("^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$") || imageData.length() > 1000000)) throw new IllegalArgumentException("La imagen debe ser PNG, JPG o WebP y pesar menos de 750 KB");
        League group = leagueRepository.findById(groupId).orElseThrow(() -> new java.util.NoSuchElementException("Grupo no encontrado"));
        group.setImageData(imageData == null || imageData.isBlank() ? null : imageData);
        return leagueRepository.save(group);
    }

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
                .collect(Collectors.toMap(e -> e.getLeague().getId(), e -> e, (e1, e2) -> e1));

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
                    .formatType(e != null && e.getCompetition() != null ? e.getCompetition().getFormatType() : null)
                    .betMode(e != null && e.getPoolFormat() != null ? e.getPoolFormat().name() : null)
                    .poolFormat(e != null && e.getPoolFormat() != null ? e.getPoolFormat().name() : null)
                    .pichichi(e != null ? e.isPichichi() : null)
                    .lockDate(e != null ? e.getLockDate() : null)
                    .isLocked(e != null && e.isLocked())
                    .rules(g.getRules())
                    .imageData(g.getImageData())
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
        Membership.MembershipId memId = new Membership.MembershipId(user.getId(), groupId);
        return membershipRepository.existsById(memId);
    }

    /**
     * Permite a un miembro normal (No-Admin) abandonar la liga por su cuenta.
     */
    @Transactional
    @org.springframework.cache.annotation.CacheEvict(value = {"userGroups", "groupById", "groupByCode", "groupResponse", "leaderboard", "allPredictionsDto", "allBetsDto", "myPredictionsDto", "myBetsDto", "rebuiltBetData", "rebuiltPredictionData"}, allEntries = true)
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
    @org.springframework.cache.annotation.CacheEvict(value = {"leaderboard", "userGroups", "allBetsDto", "allPredictionsDto", "myBetsDto", "myPredictionsDto", "rebuiltBetData", "rebuiltPredictionData"}, allEntries = true)
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
    @org.springframework.cache.annotation.CacheEvict(value = {"leaderboard", "userGroups", "allBetsDto", "allPredictionsDto", "myBetsDto", "myPredictionsDto", "rebuiltBetData", "rebuiltPredictionData"}, allEntries = true)
    public Prediction toggleBetPaymentStatus(Long groupId, Long betId, String email, boolean paid) {
        return togglePredictionPaymentStatus(groupId, betId, email, paid);
    }

    @Transactional
    @org.springframework.cache.annotation.CacheEvict(value = {"leaderboard", "userGroups", "allBetsDto", "allPredictionsDto", "myBetsDto", "myPredictionsDto", "rebuiltBetData", "rebuiltPredictionData"}, allEntries = true)
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
    @org.springframework.cache.annotation.CacheEvict(value = {"leaderboard", "userGroups", "allBetsDto", "allPredictionsDto", "myBetsDto", "myPredictionsDto", "rebuiltBetData", "rebuiltPredictionData"}, allEntries = true)
    public void deleteBet(Long groupId, Long betId, String email) {
        deletePrediction(groupId, betId, email);
    }


    /**
     * Obtiene los miembros de una liga con su rol y estado de pago.
     */
    @Transactional(readOnly = true)
    public List<GroupMemberDTO> getGroupMembers(Long groupId, String email) {
        League group = leagueRepository.findById(groupId)
                .orElseThrow(() -> new java.util.NoSuchElementException("Grupo no encontrado"));

        boolean isGlobal = "GLOBAL".equalsIgnoreCase(group.getJoinCode());
        boolean callerIsAdmin = false;

        if (email != null && !email.isBlank()) {
            boolean isLeagueAdmin = group.getAdminUser() != null && group.getAdminUser().getGoogleEmail() != null && group.getAdminUser().getGoogleEmail().equalsIgnoreCase(email);
            callerIsAdmin = isLeagueAdmin;
            if (!callerIsAdmin && !isGlobal) {
                UserAccount caller = userAccountRepository.findByGoogleEmail(email).orElse(null);
                if (caller == null || !membershipRepository.existsById(new Membership.MembershipId(caller.getId(), groupId))) {
                    throw new SecurityException("No perteneces a esta liga privada.");
                }
            }
        } else if (!isGlobal) {
            throw new SecurityException("No autenticado para consultar miembros de una liga privada.");
        }

        List<Membership> memberships = membershipRepository.findByLeagueId(groupId);
        List<GroupMemberDTO> list = new ArrayList<>();

        for (Membership m : memberships) {
            UserAccount u = m.getUser();
            if (u == null) continue;
            boolean isAdmin = "ADMIN".equalsIgnoreCase(m.getRole())
                    || (group.getAdminUser() != null && group.getAdminUser().getId().equals(u.getId()));

            String displayEmail = (callerIsAdmin || (email != null && email.equalsIgnoreCase(u.getGoogleEmail())))
                    ? u.getGoogleEmail()
                    : maskEmail(u.getGoogleEmail());

            list.add(GroupMemberDTO.builder()
                    .userId(u.getId())
                    .participantName(u.getParticipantName())
                    .googleEmail(displayEmail)
                    .role(m.getRole())
                    .paymentStatus(m.getPaymentStatus() != null ? m.getPaymentStatus() : "PENDING")
                    .joinedAt(m.getJoinedAt())
                    .isAdmin(isAdmin)
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
    @org.springframework.cache.annotation.CacheEvict(value = {"leaderboard", "userGroups", "allBetsDto", "allPredictionsDto", "myBetsDto", "myPredictionsDto", "rebuiltBetData", "rebuiltPredictionData"}, allEntries = true)
    public void toggleMemberPayment(Long groupId, Long targetUserId, String email, String status) {
        verifyGroupAdmin(groupId, email);

        Membership.MembershipId memId = new Membership.MembershipId(targetUserId, groupId);
        Membership mem = membershipRepository.findById(memId)
                .orElseThrow(() -> new java.util.NoSuchElementException("Membresía no encontrada"));

        String cleanStatus = "PAID".equalsIgnoreCase(status) ? "PAID" : "PENDING";
        mem.setPaymentStatus(cleanStatus);
        membershipRepository.save(mem);

        // Sincronizar predicciones del usuario en esta edición
        List<Prediction> preds = predictionRepository.findByEditionLeagueId(groupId);
        for (Prediction p : preds) {
            if (p.getUser() != null && p.getUser().getId().equals(targetUserId)) {
                p.setPaid("PAID".equals(cleanStatus));
                p.setPaymentStatus(cleanStatus);
                predictionRepository.save(p);
            }
        }
    }

    /**
     * Expulsa a un participante de la liga eliminando sus pronósticos y membresía.
     */
    @Transactional
    @org.springframework.cache.annotation.CacheEvict(value = {"leaderboard", "userGroups", "allBetsDto", "allPredictionsDto", "myBetsDto", "myPredictionsDto", "rebuiltBetData", "rebuiltPredictionData"}, allEntries = true)
    public void kickMember(Long groupId, Long targetUserId, String email) {
        verifyGroupAdmin(groupId, email);
        League group = leagueRepository.findById(groupId)
                .orElseThrow(() -> new java.util.NoSuchElementException("Grupo no encontrado"));

        if (group.getAdminUser() != null && group.getAdminUser().getId().equals(targetUserId)) {
            throw new IllegalArgumentException("No puedes expulsar al administrador creador de la liga.");
        }

        // Eliminar predicciones del usuario en la liga
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
     * Regenera el código de invitación de la liga si se ha filtrado.
     */
    @Transactional
    @org.springframework.cache.annotation.CacheEvict(value = {"userGroups", "groupById", "groupByCode", "groupResponse", "leaderboard", "allPredictionsDto", "allBetsDto", "myPredictionsDto", "myBetsDto", "rebuiltBetData", "rebuiltPredictionData"}, allEntries = true)
    public String regenerateJoinCode(Long groupId, String email) {
        verifyGroupAdmin(groupId, email);
        League group = leagueRepository.findById(groupId)
                .orElseThrow(() -> new java.util.NoSuchElementException("Grupo no encontrado"));

        String newCode = UUID.randomUUID().toString().substring(0, 6).toUpperCase();
        group.setJoinCode(newCode);
        leagueRepository.save(group);
        return newCode;
    }

    /**
     * Herramienta del Administrador: devuelve la lista de participantes que aún NO han pronosticado la jornada.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> getMissingMembersForRound(Long groupId, String email, String round) {
        verifyGroupAdmin(groupId, email);
        Edition edition = editionRepository.findByLeagueIdAndStatus(groupId, "ACTIVE").orElse(null);
        if (edition == null || edition.getCompetition() == null) {
            return Map.of("round", "", "totalMembers", 0, "missingCount", 0, "missingUsers", List.of());
        }

        List<Match> matches = matchRepository.findByCompetitionIdOrderByMatchDateAsc(edition.getCompetition().getId());
        if (matches.isEmpty()) {
            return Map.of("round", "", "totalMembers", 0, "missingCount", 0, "missingUsers", List.of());
        }

        String targetRound = round;
        if (targetRound == null || targetRound.isBlank()) {
            LocalDateTime now = LocalDateTime.now();
            targetRound = matches.stream()
                    .filter(m -> !Boolean.TRUE.equals(m.getFinished()) && (m.getMatchDate() == null || m.getMatchDate().isAfter(now)))
                    .map(com.porra.mundial.util.MatchRound::label)
                    .filter(Objects::nonNull)
                    .findFirst()
                    .orElse(com.porra.mundial.util.MatchRound.label(matches.get(0)));
        }

        final String finalRound = targetRound;
        List<Match> roundMatches = matches.stream()
                .filter(m -> com.porra.mundial.util.MatchRound.matches(m, finalRound))
                .collect(Collectors.toList());

        Set<Long> matchIds = roundMatches.stream().map(Match::getId).collect(Collectors.toSet());

        List<Membership> memberships = membershipRepository.findByLeagueId(groupId);
        List<MissingUserNudgeDTO> missingList = new ArrayList<>();

        for (Membership m : memberships) {
            UserAccount u = m.getUser();
            if (u == null) continue;

            // Comprobar si el usuario tiene predicción para algún partido de esta jornada
            List<MatchPrediction> userPreds = matchPredictionRepository.findByPredictionUserIdAndPredictionEditionLeagueId(u.getId(), groupId);
            Set<Long> predictedIds = userPreds.stream()
                    .filter(mp -> mp.getMatch() != null && ((mp.getHomeScore() != null && mp.getAwayScore() != null)
                            || (mp.getPredictionSign() != null && !mp.getPredictionSign().isBlank())))
                    .map(mp -> mp.getMatch().getId())
                    .collect(Collectors.toSet());
            boolean hasPredForRound = predictedIds.containsAll(matchIds);

            if (!hasPredForRound) {
                missingList.add(MissingUserNudgeDTO.builder()
                        .userId(u.getId())
                        .participantName(u.getParticipantName())
                        .build());
            }
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("round", finalRound);
        response.put("totalMembers", memberships.size());
        response.put("missingCount", missingList.size());
        response.put("missingUsers", missingList);
        return response;
    }
}
