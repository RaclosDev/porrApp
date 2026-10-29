package com.porra.mundial.service;

import com.porra.mundial.dto.GroupMemberDTO;
import com.porra.mundial.model.League;
import com.porra.mundial.model.Membership;
import com.porra.mundial.model.UserAccount;
import com.porra.mundial.model.Competition;
import com.porra.mundial.model.Edition;
import com.porra.mundial.model.Match;
import com.porra.mundial.model.MatchPrediction;
import com.porra.mundial.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

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
    private MatchPredictionRepository matchPredictionRepository;

    @Mock
    private SyncService syncService;

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
    @DisplayName("createGroup traduce competiciones legacy a la canónica con externalId")
    void createGroup_ResolvesLegacyCompetitionToCanonical() {
        when(leagueRepository.findByJoinCode(anyString())).thenReturn(Optional.empty());
        when(userAccountRepository.findByGoogleEmail("admin@test.com")).thenReturn(Optional.of(admin));
        when(leagueRepository.findByNameAndAdminUser(anyString(), any())).thenReturn(List.of());

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
        when(syncService.importCompetitionData(5L)).thenReturn(new SyncService.ImportResult("LaLiga", 0, 0));
        when(leagueRepository.save(any(League.class))).thenAnswer(invocation -> {
            League saved = invocation.getArgument(0);
            saved.setId(99L);
            return saved;
        });

        groupService.createGroup("Prueba Champions", "admin@test.com", 1L,
                com.porra.mundial.model.PoolFormat.MATCH_DAY);

        verify(editionRepository).save(argThat(edition ->
                edition.getCompetition() != null && edition.getCompetition().getId().equals(5L)));
        verify(syncService).importCompetitionData(5L);
    }

    @Test
    void missingMembersRequiresAllMatchesAndRecognizesGroupLabels() {
        when(leagueRepository.findById(10L)).thenReturn(Optional.of(league));
        var edition = Edition.builder().competition(Competition.builder().id(2L).build()).build();
        when(editionRepository.findByLeagueIdAndStatus(10L, "ACTIVE")).thenReturn(Optional.of(edition));
        var first = Match.builder().id(101L).groupName("A").build();
        var second = Match.builder().id(102L).groupName("A").build();
        var other = Match.builder().id(103L).groupName("B").build();
        when(matchRepository.findByCompetitionIdOrderByMatchDateAsc(2L)).thenReturn(List.of(first, second, other));
        when(membershipRepository.findByLeagueId(10L)).thenReturn(List.of(Membership.builder().user(member).build()));
        when(matchPredictionRepository.findByPredictionUserIdAndPredictionEditionLeagueId(2L, 10L))
                .thenReturn(List.of(MatchPrediction.builder().match(first).homeScore(1).awayScore(0).build()));
        assertEquals(1, groupService.getMissingMembersForRound(10L, "admin@test.com", "Grupo A").missingCount());
        when(matchPredictionRepository.findByPredictionUserIdAndPredictionEditionLeagueId(2L, 10L))
                .thenReturn(List.of(MatchPrediction.builder().match(first).predictionSign("1").build(),
                        MatchPrediction.builder().match(second).predictionSign("X").build()));
        assertEquals(0, groupService.getMissingMembersForRound(10L, "admin@test.com", "Grupo A").missingCount());
    }

    @Test
    void missingMembersIsAnAdminOperation() {
        when(leagueRepository.findById(10L)).thenReturn(Optional.of(league));
        assertThrows(SecurityException.class, () -> groupService.getMissingMembersForRound(10L, "stranger@test.com", "final"));
        verifyNoInteractions(matchRepository, matchPredictionRepository);
    }

    @Test
    @DisplayName("updateGroup rechaza si el nombre está vacío")
    void updateGroup_ThrowsIfEmpty() {
        when(leagueRepository.findById(10L)).thenReturn(Optional.of(league));

        assertThrows(IllegalArgumentException.class, () ->
                groupService.updateGroup(10L, "   ", null, "admin@test.com"));
    }

    @Test
    @DisplayName("updateGroup rechaza si el solicitante no es el admin de la liga")
    void updateGroup_ThrowsIfNotAdmin() {
        when(leagueRepository.findById(10L)).thenReturn(Optional.of(league));

        assertThrows(SecurityException.class, () ->
                groupService.updateGroup(10L, "Nuevo Nombre", null, "member@test.com"));

        verify(leagueRepository, never()).save(any());
    }

    @Test
    @DisplayName("deleteGroup rechaza si un usuario cualquiera intenta borrar la liga")
    void deleteGroup_ThrowsIfNotAdmin() {
        when(leagueRepository.findById(10L)).thenReturn(Optional.of(league));

        assertThrows(SecurityException.class, () ->
                groupService.deleteGroup(10L, "stranger@test.com"));

        verify(leagueRepository, never()).deleteById(any());
    }

    @Test
    @DisplayName("getMembers rechaza si el usuario solicitante no pertenece a la liga")
    void getMembers_ThrowsIfNotMember() {
        when(userAccountRepository.findByGoogleEmail("stranger@test.com")).thenReturn(Optional.of(stranger));
        when(leagueRepository.findById(10L)).thenReturn(Optional.of(league));
        when(membershipRepository.existsById(any(Membership.MembershipId.class))).thenReturn(false);

        SecurityException ex = assertThrows(SecurityException.class, () ->
                groupService.getGroupMembers(10L, "stranger@test.com"));

        assertTrue(ex.getMessage().contains("No perteneces a esta liga privada"));
    }

    @Test
    @DisplayName("getMembers ofusca el email de Google para miembros regulares pero lo muestra al admin")
    void getMembers_ObfuscatesEmailForRegularMembers() {
        when(userAccountRepository.findByGoogleEmail("member@test.com")).thenReturn(Optional.of(member));
        when(leagueRepository.findById(10L)).thenReturn(Optional.of(league));
        when(membershipRepository.existsById(any(Membership.MembershipId.class))).thenReturn(true);

        Membership mem = Membership.builder()
                .id(new Membership.MembershipId(member.getId(), league.getId()))
                .user(member)
                .league(league)
                .role("MEMBER")
                .build();

        Membership adminMem = Membership.builder()
                .id(new Membership.MembershipId(admin.getId(), league.getId()))
                .user(admin)
                .league(league)
                .role("ADMIN")
                .build();

        when(membershipRepository.findByLeagueId(10L)).thenReturn(List.of(mem, adminMem));

        List<GroupMemberDTO> members = groupService.getGroupMembers(10L, "member@test.com");

        assertEquals(2, members.size());
        assertEquals("ad***@test.com", members.get(0).getGoogleEmail(), "El email ajeno debe estar ofuscado para miembros no administradores");
        assertEquals("member@test.com", members.get(1).getGoogleEmail(), "El miembro ve su propio email sin ofuscar");
    }
    @Test
    void assertCanView_GlobalLeagueIsPublic() {
        assertDoesNotThrow(() -> groupService.assertCanView(League.GLOBAL_ID, null));
    }

    @Test
    void assertCanView_RejectsNonMembersOfPrivateLeague() {
        UserAccount stranger = UserAccount.builder().id(7L).googleEmail("stranger@test.com").build();
        when(userAccountRepository.findByGoogleEmail("stranger@test.com")).thenReturn(Optional.of(stranger));
        when(membershipRepository.existsById(any(Membership.MembershipId.class))).thenReturn(false);

        SecurityException e = assertThrows(SecurityException.class, () -> groupService.assertCanView(10L, "stranger@test.com"));
        assertEquals("No perteneces a esta liga privada", e.getMessage());
        assertThrows(SecurityException.class, () -> groupService.assertCanView(10L, null));
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
}
