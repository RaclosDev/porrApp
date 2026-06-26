package com.porra.mundial.service;

import com.porra.mundial.model.Bet;
import com.porra.mundial.model.BetGroup;
import com.porra.mundial.repository.BetGroupRepository;
import com.porra.mundial.repository.BetRepository;
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

@Service
@RequiredArgsConstructor
@Slf4j
public class GroupService {

    private final BetGroupRepository betGroupRepository;
    private final BetRepository betRepository;
    private final UserAccountRepository userAccountRepository;
    private final CompetitionRepository competitionRepository;
    private final EditionRepository editionRepository;
    private final MembershipRepository membershipRepository;

    @Value("${app.admins:Admin}")
    private List<String> appAdmins;

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

        BetGroup globalGroup = betGroupRepository.findById(1L).orElse(null);

        if (globalGroup == null) {
            // Find if any group has code GLOBAL
            globalGroup = betGroupRepository.findByJoinCode("GLOBAL").orElse(null);
            if (globalGroup == null) {
                globalGroup = BetGroup.builder()
                        .name("Porra Global")
                        .joinCode("GLOBAL")
                        .adminUser(adminUser)
                        .build();
                globalGroup = betGroupRepository.save(globalGroup);
            }
        } else {
            // Ensure group 1 is named "Porra Global", has joinCode "GLOBAL", and admin is "Admin"
            if (!"GLOBAL".equals(globalGroup.getJoinCode()) || !"Porra Global".equals(globalGroup.getName()) || !adminUser.getId().equals(globalGroup.getAdminUser().getId())) {
                try {
                    // If there's another group with join code GLOBAL, we rename it first to avoid unique constraint violation
                    betGroupRepository.findByJoinCode("GLOBAL").ifPresent(other -> {
                        if (!other.getId().equals(1L)) {
                            log.warn("Found another group with code GLOBAL: id={}. Renaming it to avoid conflict.", other.getId());
                            other.setJoinCode(UUID.randomUUID().toString().substring(0, 6).toUpperCase());
                            betGroupRepository.saveAndFlush(other);
                        }
                    });
                    
                    log.info("Updating existing group 1 to be the Global group (joinCode=GLOBAL, name=Porra Global, adminUser=Admin)");
                    globalGroup.setJoinCode("GLOBAL");
                    globalGroup.setName("Porra Global");
                    globalGroup.setAdminUser(adminUser);
                    globalGroup = betGroupRepository.saveAndFlush(globalGroup);
                } catch (Exception e) {
                    log.error("Failed to update global group, likely due to DB constraints. Error: {}", e.getMessage(), e);
                }
            }
        }

        final BetGroup finalGlobalGroup = globalGroup;

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
                    .betMode(com.porra.mundial.model.BetMode.FULL_BRACKET)
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

        // Migrate all existing bets to this global group (except the Admin template)
        List<Bet> allBets = betRepository.findAll();
        boolean migrated = false;
        for (Bet bet : allBets) {
            if (bet.getEdition() == null) {
                if (bet.getParticipantName().equalsIgnoreCase("Admin")) {
                    // Admin bet stays global (null)
                    continue;
                }
                bet.setEdition(edition);
                betRepository.save(bet);
                migrated = true;
            }
        }
        
        if (migrated) {
            log.info("Migradas las porras existentes al Grupo Global.");
        }
    }

    @Transactional
    public BetGroup createGroup(String name, String email, Long competitionId, com.porra.mundial.model.BetMode betMode) {
        return createGroup(name, email, competitionId, betMode, true);
    }

    @Transactional
    public BetGroup createGroup(String name, String email, Long competitionId, com.porra.mundial.model.BetMode betMode, boolean pichichi) {
        String joinCode;
        do {
            joinCode = UUID.randomUUID().toString().substring(0, 6).toUpperCase();
        } while (betGroupRepository.findByJoinCode(joinCode).isPresent());

        UserAccount adminUser = userAccountRepository.findByGoogleEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado por email: " + email));

        Competition comp = competitionRepository.findById(competitionId)
                .orElseThrow(() -> new IllegalArgumentException("Competición no encontrada"));

        BetGroup group = BetGroup.builder()
                .name(name)
                .joinCode(joinCode)
                .adminUser(adminUser)
                .build();
        group = betGroupRepository.save(group);

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
                .betMode(betMode)
                .pichichi(pichichi)
                .status("ACTIVE")
                .build());

        return group;
    }
    
    @Transactional
    public void joinGroupMembership(Long groupId, String email) {
        UserAccount user = userAccountRepository.findByGoogleEmail(email).orElse(null);
        if (user == null) return;
        
        BetGroup group = betGroupRepository.findById(groupId).orElse(null);
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

    @Transactional
    public BetGroup updateGroupName(Long groupId, String newName, String email) {
        verifyGroupAdmin(groupId, email);
        if (newName == null || newName.trim().isEmpty()) {
            throw new IllegalArgumentException("El nombre no puede estar vacío");
        }
        BetGroup group = betGroupRepository.findById(groupId)
                .orElseThrow(() -> new java.util.NoSuchElementException("Grupo no encontrado"));
        group.setName(newName.trim());
        return betGroupRepository.save(group);
    }

    @Transactional
    public void deleteGroup(Long groupId, String email) {
        verifyGroupAdmin(groupId, email);
        
        // Delete all bets
        List<Bet> bets = betRepository.findByEditionLeagueId(groupId);
        betRepository.deleteAll(bets);
        
        // Delete all editions
        List<Edition> editions = editionRepository.findByLeagueId(groupId);
        editionRepository.deleteAll(editions);
        
        // Delete all memberships
        List<Membership> memberships = membershipRepository.findByLeagueId(groupId);
        membershipRepository.deleteAll(memberships);
        
        // Finally, delete the group
        betGroupRepository.deleteById(groupId);
    }

    public Optional<BetGroup> getGroupByJoinCode(String joinCode) {
        return betGroupRepository.findByJoinCode(joinCode);
    }

    @Transactional(readOnly = true)
    public List<BetGroup> getUserGroups(String email) {
        UserAccount user = userAccountRepository.findByGoogleEmail(email).orElse(null);
        if (user == null) return List.of();
        
        List<Membership> memberships = membershipRepository.findByUserId(user.getId());

        List<Long> groupIds = memberships.stream()
                .map(m -> m.getLeague().getId())
                .distinct()
                .collect(Collectors.toList());

        return betGroupRepository.findAllById(groupIds);
    }

    @Transactional(readOnly = true)
    public List<com.porra.mundial.dto.GroupResponseDTO> getUserGroupDTOs(String email) {
        List<BetGroup> groups = getUserGroups(email);
        if (groups.isEmpty()) return List.of();

        List<Long> groupIds = groups.stream().map(BetGroup::getId).collect(Collectors.toList());
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
                    .competitionName(e != null ? e.getCompetition().getName() : null)
                    .betMode(e != null ? e.getBetMode().name() : null)
                    .pichichi(e != null ? e.isPichichi() : null)
                    .build();
        }).collect(Collectors.toList());
    }

    public Optional<BetGroup> getGroupById(Long id) {
        return betGroupRepository.findById(id);
    }

    @Transactional
    public void leaveGroup(Long groupId, String email) {
        BetGroup group = betGroupRepository.findById(groupId)
            .orElseThrow(() -> new java.util.NoSuchElementException("Grupo no encontrado"));

        if (group.getAdminUser().getGoogleEmail().equalsIgnoreCase(email)) {
            throw new IllegalArgumentException("El creador de la liga no puede abandonarla.");
        }

        // We delete their bets
        UserAccount user = userAccountRepository.findByGoogleEmail(email).orElse(null);
        if (user != null) {
            List<Bet> bets = betRepository.findByEditionLeagueId(groupId).stream()
                    .filter(b -> b.getUser().getId().equals(user.getId())) 
                    .collect(Collectors.toList());
            betRepository.deleteAll(bets);
            
            // Delete membership
            Membership.MembershipId memId = new Membership.MembershipId(user.getId(), groupId);
            if (membershipRepository.existsById(memId)) {
                membershipRepository.deleteById(memId);
            }
        }
    }

    private void verifyGroupAdmin(Long groupId, String email) {
        BetGroup group = betGroupRepository.findById(groupId)
                .orElseThrow(() -> new java.util.NoSuchElementException("Grupo no encontrado"));
                               
        if (!group.getAdminUser().getGoogleEmail().equalsIgnoreCase(email)) {
            throw new SecurityException("No tienes permiso para administrar esta liga.");
        }
    }

    @Transactional(readOnly = true)
    public List<Bet> getGroupBetsForAdmin(Long groupId, String email) {
        verifyGroupAdmin(groupId, email);
        return betRepository.findByEditionLeagueId(groupId);
    }

    @Transactional
    public Bet toggleBetPaymentStatus(Long groupId, Long betId, String email, boolean paid) {
        verifyGroupAdmin(groupId, email);
        Bet bet = betRepository.findById(betId)
                .orElseThrow(() -> new java.util.NoSuchElementException("Apuesta no encontrada"));
        if (!groupId.equals(bet.getGroupId())) {
            throw new IllegalArgumentException("La apuesta no pertenece a este grupo");
        }
        bet.setPaid(paid);
        return betRepository.save(bet);
    }

    @Transactional
    public void deleteBet(Long groupId, Long betId, String email) {
        verifyGroupAdmin(groupId, email);
        Bet bet = betRepository.findById(betId)
                .orElseThrow(() -> new java.util.NoSuchElementException("Apuesta no encontrada"));
        if (!groupId.equals(bet.getGroupId())) {
            throw new IllegalArgumentException("La apuesta no pertenece a este grupo");
        }
        betRepository.delete(bet);
    }

}
