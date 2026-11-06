package com.porra.mundial.service;

import com.porra.mundial.exception.BusinessException;
import com.porra.mundial.dto.GroupMemberDTO;
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
class GroupServiceTest {

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
    private GroupService groupService;

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
    @DisplayName("createGroup con una clave ya usada devuelve la liga existente sin crear otra")
    void createGroupWithRepeatedKeyReturnsExistingLeague() {
        when(userAccountRepository.findByGoogleEmail("admin@test.com")).thenReturn(Optional.of(admin));
        when(leagueRepository.findByAdminUserIdAndCreationKey(admin.getId(), "clave-1234"))
                .thenReturn(Optional.of(league));

        League result = groupService.createGroup("Liga Privada", "admin@test.com", 8L,
                com.porra.mundial.model.PoolFormat.MATCH_DAY, false, null, "clave-1234");

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

        groupService.createGroup("Liga Privada", "admin@test.com", null,
                com.porra.mundial.model.PoolFormat.MATCH_DAY, false, "Torneo local");

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

        groupService.createGroup("Liga Privada", "admin@test.com", null,
                com.porra.mundial.model.PoolFormat.FULL_BRACKET, false, "Copa local");

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

        assertThrows(BusinessException.class, () -> groupService.createGroup("Otra liga", "admin@test.com", 8L,
                com.porra.mundial.model.PoolFormat.MATCH_DAY, false));
        verify(leagueRepository, never()).save(any());
    }

    @Test
    @DisplayName("createGroup traduce competiciones legacy a la canónica con externalId")
    void createGroup_ResolvesLegacyCompetitionToCanonical() {
        when(leagueRepository.findByJoinCode(anyString())).thenReturn(Optional.empty());
        when(userAccountRepository.findByGoogleEmail("admin@test.com")).thenReturn(Optional.of(admin));

        Competition legacy = Competition.builder()
                .id(1L)
                .name("Champions League")
                .build();
        Competition canonical = Competition.builder()
                .id(5L)
                .name("UEFA Champions League")
                .externalId("uefa.champions")
                .build();

        when(competitionRepository.findById(1L)).thenReturn(Optional.of(legacy));
        when(competitionRepository.findByExternalId("uefa.champions")).thenReturn(Optional.of(canonical));
        when(matchRepository.countByCompetitionId(5L)).thenReturn(0L);
        when(leagueRepository.save(any(League.class))).thenAnswer(invocation -> {
            League saved = invocation.getArgument(0);
            saved.setId(99L);
            return saved;
        });

        groupService.createGroup("Prueba Champions", "admin@test.com", 1L,
                com.porra.mundial.model.PoolFormat.MATCH_DAY);

        verify(editionRepository).save(argThat(edition ->
                edition.getCompetition() != null && edition.getCompetition().getId().equals(5L)));
        // La importación se pide para después de confirmar la liga, no dentro de su transacción.
        verify(eventPublisher).publishEvent(new CompetitionImportRequestedEvent(5L));
    }

    @Test
    void createWorldCupBracketHasTheTournamentDeadline() {
        when(userAccountRepository.findByGoogleEmail("admin@test.com")).thenReturn(Optional.of(admin));
        Competition worldCup = Competition.builder().id(2L)
                .externalId(Competition.WORLD_CUP_EXTERNAL_ID).build();
        when(competitionRepository.findById(2L)).thenReturn(Optional.of(worldCup));
        when(leagueRepository.save(any(League.class))).thenReturn(league);

        groupService.createGroup("Mundial", "admin@test.com", 2L,
                com.porra.mundial.model.PoolFormat.FULL_BRACKET);

        verify(editionRepository).save(argThat(edition ->
                java.time.Instant.parse("2026-06-11T18:00:00Z").equals(edition.getLockDate())));
    }

    @Test
    @DisplayName("updateGroup rechaza si el nombre está vacío")
    void updateGroup_ThrowsIfEmpty() {
        when(leagueRepository.findById(10L)).thenReturn(Optional.of(league));

        assertThrows(BusinessException.class, () ->
                groupService.updateGroup(10L, "   ", null, null, "admin@test.com"));
    }

    @Test
    @DisplayName("updateGroup activa la cuota de una liga privada")
    void updateGroup_EnablesEntryFee() {
        when(leagueRepository.findById(10L)).thenReturn(Optional.of(league));
        when(leagueRepository.save(league)).thenReturn(league);

        groupService.updateGroup(10L, null, null, true, "admin@test.com");

        assertTrue(league.isEntryFee());
    }

    @Test
    @DisplayName("updateGroup no deja poner cuota a una liga pública")
    void updateGroup_RejectsEntryFeeOnPublicLeague() {
        league.setPublicLeague(true);
        when(leagueRepository.findById(10L)).thenReturn(Optional.of(league));

        assertThrows(BusinessException.class, () ->
                groupService.updateGroup(10L, null, null, true, "admin@test.com"));
        verify(leagueRepository, never()).save(any());
    }

    @Test
    @DisplayName("updateGroup rechaza si el solicitante no es el admin de la liga")
    void updateGroup_ThrowsIfNotAdmin() {
        when(leagueRepository.findById(10L)).thenReturn(Optional.of(league));

        assertThrows(BusinessException.class, () ->
                groupService.updateGroup(10L, "Nuevo Nombre", null, null, "member@test.com"));

        verify(leagueRepository, never()).save(any());
    }

    @Test
    @DisplayName("deleteGroup rechaza si un usuario cualquiera intenta borrar la liga")
    void deleteGroup_ThrowsIfNotAdmin() {
        when(leagueRepository.findById(10L)).thenReturn(Optional.of(league));

        assertThrows(BusinessException.class, () ->
                groupService.deleteGroup(10L, "stranger@test.com"));

        verify(leagueRepository, never()).deleteById(any());
    }

    @Test
    void assertCanView_PublicLeagueIsOpen() {
        when(leagueRepository.findById(50L)).thenReturn(Optional.of(
                League.builder().id(50L).name("Abierta").joinCode("ABIERTA").publicLeague(true).build()));
        assertDoesNotThrow(() -> groupService.assertCanView(50L, null));
    }

    @Test
    void assertCanView_RejectsNonMembersOfPrivateLeague() {
        UserAccount stranger = UserAccount.builder().id(7L).googleEmail("stranger@test.com").build();
        when(userAccountRepository.findByGoogleEmail("stranger@test.com")).thenReturn(Optional.of(stranger));
        when(membershipRepository.existsById(any(Membership.MembershipId.class))).thenReturn(false);

        BusinessException e = assertThrows(BusinessException.class, () -> groupService.assertCanView(10L, "stranger@test.com"));
        assertEquals("No perteneces a esta liga privada", e.getMessage());
        assertThrows(BusinessException.class, () -> groupService.assertCanView(10L, null));
    }

    @Test
    void assertCanView_AllowsMembers() {
        UserAccount member = UserAccount.builder().id(8L).googleEmail("member@test.com").build();
        when(userAccountRepository.findByGoogleEmail("member@test.com")).thenReturn(Optional.of(member));
        when(membershipRepository.existsById(new Membership.MembershipId(8L, 10L))).thenReturn(true);

        assertDoesNotThrow(() -> groupService.assertCanView(10L, "member@test.com"));
    }

    @Test
    @DisplayName("Regenerar el código da uno nuevo de 10 caracteres base32 y lo guarda")
    void regenerateJoinCodeUsesLongSecureCodes() {
        when(leagueRepository.findById(10L)).thenReturn(Optional.of(league));
        when(leagueRepository.findByJoinCode(anyString())).thenReturn(Optional.empty());

        String code = groupService.regenerateJoinCode(10L, "admin@test.com");

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

        assertTrue(groupService.findGroupResponse(10L, "stranger@test.com").isEmpty());
        assertTrue(groupService.findGroupResponse(10L, null).isEmpty());
    }

    @Test
    @DisplayName("Un miembro ve la liga completa con su código")
    void memberGetsFullLeague() {
        league.setRules("Reglas internas");
        when(leagueRepository.findById(10L)).thenReturn(Optional.of(league));
        when(userAccountRepository.findByGoogleEmail("member@test.com")).thenReturn(Optional.of(member));
        when(membershipRepository.existsById(new Membership.MembershipId(2L, 10L))).thenReturn(true);

        var dto = groupService.findGroupResponse(10L, "member@test.com").orElseThrow();

        assertEquals("AMIGOS", dto.getJoinCode());
        assertEquals("Reglas internas", dto.getRules());
        assertEquals(1L, dto.getAdminUserId());
    }
}
