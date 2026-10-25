package com.porra.mundial.service;

import com.porra.mundial.dto.GroupMemberDTO;
import com.porra.mundial.model.League;
import com.porra.mundial.model.Membership;
import com.porra.mundial.model.UserAccount;
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
                .isSuperadmin(false)
                .build();

        member = UserAccount.builder()
                .id(2L)
                .googleEmail("member@test.com")
                .participantName("Miembro Regular")
                .isSuperadmin(false)
                .build();

        stranger = UserAccount.builder()
                .id(3L)
                .googleEmail("stranger@test.com")
                .participantName("Desconocido")
                .isSuperadmin(false)
                .build();

        league = League.builder()
                .id(10L)
                .name("Liga Privada")
                .joinCode("AMIGOS")
                .adminUser(admin)
                .build();
    }

    @Test
    @DisplayName("updateGroupName rechaza si el nombre está vacío")
    void updateGroupName_ThrowsIfEmpty() {
        when(leagueRepository.findById(10L)).thenReturn(Optional.of(league));

        assertThrows(IllegalArgumentException.class, () ->
                groupService.updateGroupName(10L, "   ", "admin@test.com"));
    }

    @Test
    @DisplayName("updateGroupName rechaza si el solicitante no es el admin de la liga")
    void updateGroupName_ThrowsIfNotAdmin() {
        when(leagueRepository.findById(10L)).thenReturn(Optional.of(league));

        assertThrows(SecurityException.class, () ->
                groupService.updateGroupName(10L, "Nuevo Nombre", "member@test.com"));

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
}
