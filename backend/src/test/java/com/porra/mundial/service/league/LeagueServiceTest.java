package com.porra.mundial.service.league;

import com.porra.mundial.service.sync.CompetitionImportRequestedEvent;
import com.porra.mundial.exception.BusinessException;
import com.porra.mundial.dto.LeagueMemberDTO;
import com.porra.mundial.model.League;
import com.porra.mundial.model.Membership;
import com.porra.mundial.model.UserAccount;
import com.porra.mundial.model.Competition;
import com.porra.mundial.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class LeagueServiceTest {

    @Mock
    private LeagueRepository leagueRepository;

    @Mock
    private UserAccountRepository userAccountRepository;

    @Mock
    private CompetitionRepository competitionRepository;

    @Mock
    private EditionRepository editionRepository;

    @Mock
    private MembershipRepository membershipRepository;

    @Mock
    private PredictionRepository predictionRepository;

    @Mock
    private MatchRepository matchRepository;

    @Mock
    private ApplicationEventPublisher eventPublisher;

    @Mock
    private LeaguePaymentService paymentService;

    @InjectMocks
    private LeagueService leagueService;

    private UserAccount admin;
    private UserAccount member;
    private UserAccount stranger;
    private League league;

    @BeforeEach
    void setUp() {
        admin = UserAccount.builder()
                .id(1L)
                .googleEmail("admin@test.com")
                .participantName("Admin Liga")
                .build();

        member = UserAccount.builder()
                .id(2L)
                .googleEmail("member@test.com")
                .participantName("Miembro Regular")
                .build();

        stranger = UserAccount.builder()
                .id(3L)
                .googleEmail("stranger@test.com")
                .participantName("Desconocido")
                .build();

        league = League.builder()
                .id(10L)
                .name("Liga Privada")
                .joinCode("AMIGOS")
                .adminUser(admin)
                .build();
    }

    @Test
    @DisplayName("Mis ligas incluyen cuándo se unió el usuario a cada una")
    void myLeaguesIncludeWhenTheUserJoined() {
        java.time.Instant joined = java.time.Instant.parse("2026-11-01T10:00:00Z");
        Membership membership = new Membership();
        membership.setId(new Membership.MembershipId(2L, 10L));
        membership.setJoinedAt(joined);
        when(userAccountRepository.findByGoogleEmail("member@test.com")).thenReturn(Optional.of(member));
        when(membershipRepository.findByUserId(2L)).thenReturn(List.of(membership));
        when(leagueRepository.findAllById(java.util.Set.of(10L))).thenReturn(List.of(league));
        when(editionRepository.findByLeagueIdInAndStatus(List.of(10L), "ACTIVE")).thenReturn(List.of());

        var mine = leagueService.getUserLeagueDTOs("member@test.com");

        assertEquals(1, mine.size());
        assertEquals(10L, mine.get(0).getId());
        assertEquals(joined, mine.get(0).getJoinedAt());
    }

    @Test
    @DisplayName("createLeague con una clave ya usada devuelve la liga existente sin crear otra")
    void createGroupWithRepeatedKeyReturnsExistingLeague() {
        when(userAccountRepository.findByGoogleEmail("admin@test.com")).thenReturn(Optional.of(admin));
        when(leagueRepository.findByAdminUserIdAndCreationKey(admin.getId(), "clave-1234"))
                .thenReturn(Optional.of(league));

        League result = leagueService.createLeague(NewLeague.of("Liga Privada", "admin@test.com", 8L,
                com.porra.mundial.model.PoolFormat.MATCH_DAY).withPichichi(false).withCreationKey("clave-1234"));

        assertSame(league, result);
        verify(leagueRepository, never()).save(any());
        verify(editionRepository, never()).save(any());
    }

    @Test
    void createCustomCompetitionBelongsToNewLeague() {
        when(leagueRepository.findByJoinCode(anyString())).thenReturn(Optional.empty());
        when(userAccountRepository.findByGoogleEmail("admin@test.com")).thenReturn(Optional.of(admin));
        when(leagueRepository.save(any(League.class))).thenReturn(league);
        when(competitionRepository.save(any(Competition.class))).thenAnswer(invocation -> invocation.getArgument(0));

        leagueService.createLeague(NewLeague.custom("Liga Privada", "admin@test.com", "Torneo local",
                com.porra.mundial.model.PoolFormat.MATCH_DAY).withPichichi(false));

        var competition = org.mockito.ArgumentCaptor.forClass(Competition.class);
        verify(competitionRepository).save(competition.capture());
        assertEquals(league, competition.getValue().getOwnerLeague());
        assertEquals("Torneo local", competition.getValue().getName());
        verify(editionRepository).save(argThat(edition -> !edition.isPichichi()
                && edition.getCompetition() == competition.getValue()));
    }

    @Test
    void createCustomBracketCompetitionUsesTournamentFormat() {
        when(leagueRepository.findByJoinCode(anyString())).thenReturn(Optional.empty());
        when(userAccountRepository.findByGoogleEmail("admin@test.com")).thenReturn(Optional.of(admin));
        when(leagueRepository.save(any(League.class))).thenReturn(league);
        when(competitionRepository.save(any(Competition.class))).thenAnswer(invocation -> invocation.getArgument(0));

        leagueService.createLeague(NewLeague.custom("Liga Privada", "admin@test.com", "Copa local",
                com.porra.mundial.model.PoolFormat.FULL_BRACKET).withPichichi(false));

        verify(competitionRepository).save(argThat(competition -> "TOURNAMENT".equals(competition.getFormatType())
                && competition.getOwnerLeague() == league));
        verify(editionRepository).save(argThat(edition -> edition.getPoolFormat()
                == com.porra.mundial.model.PoolFormat.FULL_BRACKET));
    }

    @Test
    void existingCustomCompetitionCannotBeReusedByAnotherLeague() {
        when(leagueRepository.findByJoinCode(anyString())).thenReturn(Optional.empty());
        when(userAccountRepository.findByGoogleEmail("admin@test.com")).thenReturn(Optional.of(admin));
        when(competitionRepository.findById(8L)).thenReturn(Optional.of(Competition.builder()
                .ownerLeague(league).build()));

        assertThrows(BusinessException.class, () -> leagueService.createLeague(NewLeague.of("Otra liga", "admin@test.com", 8L,
                com.porra.mundial.model.PoolFormat.MATCH_DAY).withPichichi(false)));
        verify(leagueRepository, never()).save(any());
    }

    @Test
    @DisplayName("createLeague no adivina la competición de una sin proveedor por su nombre")
    void createGroup_RejectsCompetitionWithoutProvider() {
        when(leagueRepository.findByJoinCode(anyString())).thenReturn(Optional.empty());
        when(userAccountRepository.findByGoogleEmail("admin@test.com")).thenReturn(Optional.of(admin));
        // Una competición antigua sin id externo: antes «Mundial» en el nombre la convertía en el Mundial.
        when(competitionRepository.findById(1L)).thenReturn(Optional.of(Competition.builder()
                .id(1L).name("Mundial de clubes").build()));

        BusinessException error = assertThrows(BusinessException.class, () -> leagueService.createLeague(
                NewLeague.of("Prueba", "admin@test.com", 1L, com.porra.mundial.model.PoolFormat.FULL_BRACKET)));

        assertEquals(400, error.getStatus().value());
        verify(competitionRepository, never()).findByExternalId(anyString());
        verify(leagueRepository, never()).save(any());
    }

    @Test
    @DisplayName("createLeague exige el formato: no hay cuadro por defecto")
    void createGroup_RequiresPoolFormat() {
        assertThrows(BusinessException.class, () -> leagueService.createLeague(
                NewLeague.of("Sin formato", "admin@test.com", 2L, null)));
        verify(leagueRepository, never()).save(any());
        verify(editionRepository, never()).save(any());
    }

    @Test
    @DisplayName("Solo el cuadro del Mundial guarda el pichichi")
    void createGroup_KeepsPichichiOnlyForTheWorldCupBracket() {
        when(userAccountRepository.findByGoogleEmail("admin@test.com")).thenReturn(Optional.of(admin));
        when(leagueRepository.save(any(League.class))).thenReturn(league);
        when(competitionRepository.findById(5L)).thenReturn(Optional.of(Competition.builder().id(5L)
                .externalId("uefa.champions").formatType("LEAGUE").build()));
        when(competitionRepository.findById(2L)).thenReturn(Optional.of(Competition.builder().id(2L)
                .externalId(Competition.WORLD_CUP_EXTERNAL_ID).formatType("TOURNAMENT").build()));

        leagueService.createLeague(NewLeague.of("Champions", "admin@test.com", 5L,
                com.porra.mundial.model.PoolFormat.MATCH_DAY).withPichichi(true));
        leagueService.createLeague(NewLeague.of("Mundial por jornadas", "admin@test.com", 2L,
                com.porra.mundial.model.PoolFormat.MATCH_DAY).withPichichi(true));
        leagueService.createLeague(NewLeague.of("Mundial", "admin@test.com", 2L,
                com.porra.mundial.model.PoolFormat.FULL_BRACKET).withPichichi(true));

        org.mockito.ArgumentCaptor<com.porra.mundial.model.Edition> saved =
                org.mockito.ArgumentCaptor.forClass(com.porra.mundial.model.Edition.class);
        verify(editionRepository, org.mockito.Mockito.times(3)).save(saved.capture());
        assertEquals(java.util.List.of(false, false, true),
                saved.getAllValues().stream().map(com.porra.mundial.model.Edition::isPichichi).toList());
    }

    @Test
    void createWorldCupBracketHasTheTournamentDeadline() {
        when(userAccountRepository.findByGoogleEmail("admin@test.com")).thenReturn(Optional.of(admin));
        Competition worldCup = Competition.builder().id(2L)
                .externalId(Competition.WORLD_CUP_EXTERNAL_ID).build();
        when(competitionRepository.findById(2L)).thenReturn(Optional.of(worldCup));
        when(leagueRepository.save(any(League.class))).thenReturn(league);

        leagueService.createLeague(NewLeague.of("Mundial", "admin@test.com", 2L,
                com.porra.mundial.model.PoolFormat.FULL_BRACKET));

        verify(editionRepository).save(argThat(edition ->
                java.time.Instant.parse("2026-06-11T18:00:00Z").equals(edition.getLockDate())));
    }

    @Test
    void aRegularLeagueHasNoBracketToFillIn() {
        when(userAccountRepository.findByGoogleEmail("admin@test.com")).thenReturn(Optional.of(admin));
        Competition laLiga = Competition.builder().id(3L).externalId("esp.1").formatType("LEAGUE").build();
        when(competitionRepository.findById(3L)).thenReturn(Optional.of(laLiga));

        for (var format : java.util.List.of(com.porra.mundial.model.PoolFormat.FULL_BRACKET,
                com.porra.mundial.model.PoolFormat.KNOCKOUTS_ONLY)) {
            BusinessException error = assertThrows(BusinessException.class, () -> leagueService.createLeague(
                    NewLeague.of("LaLiga", "admin@test.com", 3L, format)));
            assertEquals("Esta competición se juega por jornadas: no tiene cuadro que rellenar", error.getMessage());
        }
        verify(leagueRepository, org.mockito.Mockito.never()).save(any(League.class));
    }

    @Test
    @DisplayName("updateLeague rechaza si el nombre está vacío")
    void updateGroup_ThrowsIfEmpty() {
        when(leagueRepository.findById(10L)).thenReturn(Optional.of(league));

        assertThrows(BusinessException.class, () ->
                leagueService.updateLeague(10L, "   ", null, null, "admin@test.com"));
    }

    @Test
    @DisplayName("updateLeague activa la cuota de una liga privada")
    void updateGroup_EnablesEntryFee() {
        when(leagueRepository.findById(10L)).thenReturn(Optional.of(league));
        when(leagueRepository.save(league)).thenReturn(league);

        leagueService.updateLeague(10L, null, null, true, "admin@test.com");

        assertTrue(league.isEntryFee());
    }

    @Test
    @DisplayName("updateLeague no deja poner cuota a una liga pública")
    void updateGroup_RejectsEntryFeeOnPublicLeague() {
        league.setPublicLeague(true);
        when(leagueRepository.findById(10L)).thenReturn(Optional.of(league));

        assertThrows(BusinessException.class, () ->
                leagueService.updateLeague(10L, null, null, true, "admin@test.com"));
        verify(leagueRepository, never()).save(any());
    }

    @Test
    @DisplayName("updateLeague rechaza si el solicitante no es el admin de la liga")
    void updateGroup_ThrowsIfNotAdmin() {
        when(leagueRepository.findById(10L)).thenReturn(Optional.of(league));

        assertThrows(BusinessException.class, () ->
                leagueService.updateLeague(10L, "Nuevo Nombre", null, null, "member@test.com"));

        verify(leagueRepository, never()).save(any());
    }

    @Test
    @DisplayName("deleteLeague rechaza si un usuario cualquiera intenta borrar la liga")
    void deleteGroup_ThrowsIfNotAdmin() {
        when(leagueRepository.findById(10L)).thenReturn(Optional.of(league));

        assertThrows(BusinessException.class, () ->
                leagueService.deleteLeague(10L, "stranger@test.com"));

        verify(leagueRepository, never()).deleteById(any());
    }

    @Test
    void assertCanView_PublicLeagueIsOpen() {
        when(leagueRepository.findById(50L)).thenReturn(Optional.of(
                League.builder().id(50L).name("Abierta").joinCode("ABIERTA").publicLeague(true).build()));
        assertDoesNotThrow(() -> leagueService.assertCanView(50L, null));
    }

    @Test
    void assertCanView_RejectsNonMembersOfPrivateLeague() {
        UserAccount stranger = UserAccount.builder().id(7L).googleEmail("stranger@test.com").build();
        when(userAccountRepository.findByGoogleEmail("stranger@test.com")).thenReturn(Optional.of(stranger));
        when(membershipRepository.existsById(any(Membership.MembershipId.class))).thenReturn(false);

        BusinessException e = assertThrows(BusinessException.class, () -> leagueService.assertCanView(10L, "stranger@test.com"));
        assertEquals("No perteneces a esta liga privada", e.getMessage());
        assertThrows(BusinessException.class, () -> leagueService.assertCanView(10L, null));
    }

    @Test
    void assertCanView_AllowsMembers() {
        UserAccount member = UserAccount.builder().id(8L).googleEmail("member@test.com").build();
        when(userAccountRepository.findByGoogleEmail("member@test.com")).thenReturn(Optional.of(member));
        when(membershipRepository.existsById(new Membership.MembershipId(8L, 10L))).thenReturn(true);

        assertDoesNotThrow(() -> leagueService.assertCanView(10L, "member@test.com"));
    }

    @Test
    @DisplayName("Regenerar el código da uno nuevo de 10 caracteres base32 y lo guarda")
    void regenerateJoinCodeUsesLongSecureCodes() {
        when(leagueRepository.findById(10L)).thenReturn(Optional.of(league));
        when(leagueRepository.findByJoinCode(anyString())).thenReturn(Optional.empty());

        String code = leagueService.regenerateJoinCode(10L, "admin@test.com");

        assertTrue(code.matches("[A-HJ-NP-Z2-9]{10}"), code);
        assertEquals(code, league.getJoinCode());
        verify(leagueRepository).save(league);
    }

    @Test
    @DisplayName("Una liga privada no existe para quien no es miembro, ni con sesión ni sin ella")
    void nonMemberCannotSeePrivateLeague() {
        when(leagueRepository.findById(10L)).thenReturn(Optional.of(league));
        when(userAccountRepository.findByGoogleEmail("stranger@test.com")).thenReturn(Optional.of(stranger));
        when(membershipRepository.existsById(new Membership.MembershipId(3L, 10L))).thenReturn(false);

        assertTrue(leagueService.findLeagueResponse(10L, "stranger@test.com").isEmpty());
        assertTrue(leagueService.findLeagueResponse(10L, null).isEmpty());
    }

    @Test
    @DisplayName("Un miembro ve la liga completa con su código")
    void memberGetsFullLeague() {
        league.setRules("Reglas internas");
        when(leagueRepository.findById(10L)).thenReturn(Optional.of(league));
        when(userAccountRepository.findByGoogleEmail("member@test.com")).thenReturn(Optional.of(member));
        when(membershipRepository.existsById(new Membership.MembershipId(2L, 10L))).thenReturn(true);

        var dto = leagueService.findLeagueResponse(10L, "member@test.com").orElseThrow();

        assertEquals("AMIGOS", dto.getJoinCode());
        assertEquals("Reglas internas", dto.getRules());
        assertEquals(1L, dto.getAdminUserId());
    }

    @Test
    void championsKnockoutsCloseRoundByRoundAndRejectTheFullBracket() {
        when(userAccountRepository.findByGoogleEmail("admin@test.com")).thenReturn(Optional.of(admin));
        Competition champions = Competition.builder().id(5L).externalId("uefa.champions").formatType("LEAGUE").build();
        when(competitionRepository.findById(5L)).thenReturn(Optional.of(champions));
        lenient().when(leagueRepository.save(any(League.class))).thenReturn(league);

        assertThrows(BusinessException.class, () -> leagueService.createLeague(NewLeague.of("Champions", "admin@test.com", 5L,
                com.porra.mundial.model.PoolFormat.FULL_BRACKET)));

        leagueService.createLeague(NewLeague.of("Champions", "admin@test.com", 5L,
                com.porra.mundial.model.PoolFormat.KNOCKOUTS_ONLY));
        verify(editionRepository).save(argThat(edition ->
                edition.getLockMode() == com.porra.mundial.model.PredictionLockMode.PER_ROUND));
    }

    @Test
    void tennisIsPlayedMatchByMatchWithTennisScoring() {
        when(userAccountRepository.findByGoogleEmail("admin@test.com")).thenReturn(Optional.of(admin));
        Competition rolandGarros = Competition.builder().id(6L).externalId("tennis.atp.172").formatType("TOURNAMENT").build();
        when(competitionRepository.findById(6L)).thenReturn(Optional.of(rolandGarros));
        lenient().when(leagueRepository.save(any(League.class))).thenReturn(league);

        assertThrows(BusinessException.class, () -> leagueService.createLeague(NewLeague.of("RG", "admin@test.com", 6L,
                com.porra.mundial.model.PoolFormat.KNOCKOUTS_ONLY)));

        leagueService.createLeague(NewLeague.of("RG", "admin@test.com", 6L, com.porra.mundial.model.PoolFormat.MATCH_DAY));
        verify(editionRepository).save(argThat(edition -> com.porra.mundial.scoring.ScoringRuleSet.defaultTennis().toJson()
                .equals(edition.getScoringRulesJson())));
    }
}
