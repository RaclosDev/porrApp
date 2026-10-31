package com.porra.mundial.config;

import com.porra.mundial.model.Competition;
import com.porra.mundial.model.Edition;
import com.porra.mundial.model.League;
import com.porra.mundial.model.Membership;
import com.porra.mundial.model.UserAccount;
import com.porra.mundial.repository.CompetitionRepository;
import com.porra.mundial.repository.EditionRepository;
import com.porra.mundial.repository.LeagueRepository;
import com.porra.mundial.repository.MembershipRepository;
import com.porra.mundial.repository.UserAccountRepository;
import com.porra.mundial.util.JoinCodeGenerator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Prepara la liga global en una transacción antes de la sincronización inicial. */
@Component
@Order(0)
@RequiredArgsConstructor
@Slf4j
public class GlobalLeagueInitializer implements CommandLineRunner {
    private final LeagueRepository leagueRepository;
    private final UserAccountRepository userAccountRepository;
    private final CompetitionRepository competitionRepository;
    private final EditionRepository editionRepository;
    private final MembershipRepository membershipRepository;

    /** Al arrancar, garantiza la Porra Global (id, código, edición y administrador). */
    @Override
    @Transactional
    public void run(String... args) {
        UserAccount adminUser = userAccountRepository.findByParticipantName("Admin")
                .orElseGet(() -> userAccountRepository.save(UserAccount.builder()
                        .googleEmail(UserAccount.SYSTEM_ADMIN_EMAIL)
                        .googleName("Admin")
                        .participantName("Admin")
                        .build()));

        League globalGroup = leagueRepository.findById(League.GLOBAL_ID).orElse(null);

        if (globalGroup == null) {
            // Find if any group has code GLOBAL
            globalGroup = leagueRepository.findByJoinCode(League.GLOBAL_JOIN_CODE).orElse(null);
            if (globalGroup == null) {
                globalGroup = League.builder()
                        .name(League.GLOBAL_NAME)
                        .joinCode(League.GLOBAL_JOIN_CODE)
                        .adminUser(adminUser)
                        .build();
                globalGroup = leagueRepository.save(globalGroup);
            }
        } else {
            // Normalize the global league without overwriting a real administrator.
            UserAccount currentAdmin = globalGroup.getAdminUser();
            String currentAdminEmail = currentAdmin != null ? currentAdmin.getGoogleEmail() : null;
            boolean currentAdminIsPlaceholder = currentAdmin == null
                    || UserAccount.SYSTEM_ADMIN_EMAIL.equalsIgnoreCase(currentAdminEmail)
                    || (currentAdminEmail != null && currentAdminEmail.toLowerCase(java.util.Locale.ROOT).endsWith("@auto.generated"));

            boolean metadataNeedsUpdate = !League.GLOBAL_JOIN_CODE.equals(globalGroup.getJoinCode())
                    || !League.GLOBAL_NAME.equals(globalGroup.getName());
            boolean adminNeedsUpdate = currentAdminIsPlaceholder
                    && (currentAdmin == null || !adminUser.getId().equals(currentAdmin.getId()));

            if (metadataNeedsUpdate || adminNeedsUpdate) {
                try {
                    // Avoid a unique-code conflict if another league currently uses GLOBAL.
                    leagueRepository.findByJoinCode(League.GLOBAL_JOIN_CODE).ifPresent(other -> {
                        if (!League.isGlobalId(other.getId())) {
                            log.warn("Found another group with code GLOBAL: id={}. Renaming it to avoid conflict.", other.getId());
                            other.setJoinCode(JoinCodeGenerator.next());
                            leagueRepository.saveAndFlush(other);
                        }
                    });

                    globalGroup.setJoinCode(League.GLOBAL_JOIN_CODE);
                    globalGroup.setName(League.GLOBAL_NAME);
                    if (adminNeedsUpdate) {
                        log.info("Replacing placeholder administrator of Porra Global with the default Admin account.");
                        globalGroup.setAdminUser(adminUser);
                    }
                    globalGroup = leagueRepository.saveAndFlush(globalGroup);
                } catch (Exception e) {
                    log.error("Failed to normalize the global league. Error: {}", e.getMessage(), e);
                }
            }
        }

        final League finalGlobalGroup = globalGroup;

        // Ensure competition exists (siempre la canónica con proveedor externo)
        Competition comp = competitionRepository.findByExternalId(Competition.WORLD_CUP_EXTERNAL_ID)
            .or(() -> competitionRepository.findByName("FIFA World Cup 2026"))
            .orElseGet(() -> competitionRepository.save(Competition.builder()
                    .name("FIFA World Cup 2026")
                    .externalId(Competition.WORLD_CUP_EXTERNAL_ID)
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

        // Ensure the current league administrator has an ADMIN membership, even if a stale
        // MEMBER membership already exists from before an administrator change.
        Membership.MembershipId memId = new Membership.MembershipId(finalGlobalGroup.getAdminUser().getId(), finalGlobalGroup.getId());
        Membership adminMembership = membershipRepository.findById(memId).orElse(null);
        if (adminMembership == null) {
            membershipRepository.save(Membership.builder()
                .id(memId)
                .user(finalGlobalGroup.getAdminUser())
                .league(finalGlobalGroup)
                .role("ADMIN")
                .build());
        } else if (!"ADMIN".equalsIgnoreCase(adminMembership.getRole())) {
            adminMembership.setRole("ADMIN");
            membershipRepository.save(adminMembership);
        }

    }
}
