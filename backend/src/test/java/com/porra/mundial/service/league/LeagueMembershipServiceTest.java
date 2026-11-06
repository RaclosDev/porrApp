package com.porra.mundial.service.league;

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
class LeagueMembershipServiceTest {

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
    private LeagueMembershipService membershipService;

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
    @DisplayName("getMembers rechaza si el usuario solicitante no pertenece a la liga")
    void getMembers_ThrowsIfNotMember() {
        when(userAccountRepository.findByGoogleEmail("stranger@test.com")).thenReturn(Optional.of(stranger));
        when(leagueRepository.findById(10L)).thenReturn(Optional.of(league));
        when(membershipRepository.existsById(any(Membership.MembershipId.class))).thenReturn(false);

        BusinessException ex = assertThrows(BusinessException.class, () ->
                membershipService.members(10L, "stranger@test.com"));

        assertTrue(ex.getMessage().contains("No perteneces a esta liga privada"));
    }

    @Test
    @DisplayName("getMembers no expone el email de ningún miembro")
    void getMembers_NeverExposesEmails() {
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

        List<LeagueMemberDTO> members = membershipService.members(10L, "member@test.com");

        assertEquals(2, members.size());
        members.forEach(m -> assertFalse(m.toString().contains("@"), "La respuesta no debe incluir emails"));
    }

    @Test
    @DisplayName("En una liga pública los miembros salen sin email ni estado de pago")
    void publicLeagueMembersHideEmailAndPayment() {
        League global = League.builder().id(50L).name("Abierta")
                .joinCode("ABIERTA").publicLeague(true).adminUser(admin).build();
        when(leagueRepository.findById(50L)).thenReturn(Optional.of(global));
        Membership mem = Membership.builder()
                .id(new Membership.MembershipId(member.getId(), 50L))
                .user(member).league(global).role("MEMBER").paymentStatus("PAID").build();
        when(membershipRepository.findByLeagueId(50L)).thenReturn(List.of(mem));

        for (String viewer : new String[] {null, "member@test.com", "admin@test.com"}) {
            List<LeagueMemberDTO> members = membershipService.members(50L, viewer);
            assertEquals(1, members.size());
            assertNull(members.get(0).getPaymentStatus());
            assertEquals("Miembro Regular", members.get(0).getParticipantName());
        }
    }

    @Test
    void paymentRouteDelegatesToTheSharedMembershipPaymentService() {
        when(leagueRepository.findById(league.getId())).thenReturn(Optional.of(league));
        when(userAccountRepository.findByGoogleEmail(admin.getGoogleEmail())).thenReturn(Optional.of(admin));
        membershipService.setPayment(league.getId(), member.getId(), admin.getGoogleEmail(), "PAID");
        verify(paymentService).setPayment(league.getId(), member.getId(), "PAID", admin);
    }

    @Test
    void joiningPublishesTheMemberJoinedEventForTheNewMemberOnly() {
        when(userAccountRepository.findByGoogleEmail("member@test.com")).thenReturn(Optional.of(member));
        when(leagueRepository.findById(10L)).thenReturn(Optional.of(league));
        when(membershipRepository.existsById(any())).thenReturn(false);

        membershipService.join(10L, "member@test.com");

        verify(membershipRepository).save(any(Membership.class));
        verify(eventPublisher).publishEvent(new MemberJoinedLeagueEvent(10L, 2L));
    }

    @Test
    void joiningAgainDoesNotNotifyTheLeague() {
        when(userAccountRepository.findByGoogleEmail("member@test.com")).thenReturn(Optional.of(member));
        when(leagueRepository.findById(10L)).thenReturn(Optional.of(league));
        when(membershipRepository.existsById(any())).thenReturn(true);

        membershipService.join(10L, "member@test.com");

        verify(eventPublisher, never()).publishEvent(any(MemberJoinedLeagueEvent.class));
    }

    @Test
    @DisplayName("transferAdmin cede la liga a un miembro e intercambia los roles")
    void transferAdminSwapsRoles() {
        Membership adminMembership = Membership.builder().user(admin).league(league).role("ADMIN").build();
        Membership memberMembership = Membership.builder().user(member).league(league).role("MEMBER").build();
        when(leagueRepository.findById(10L)).thenReturn(Optional.of(league));
        when(membershipRepository.findById(new Membership.MembershipId(2L, 10L)))
                .thenReturn(Optional.of(memberMembership));
        when(membershipRepository.findById(new Membership.MembershipId(1L, 10L)))
                .thenReturn(Optional.of(adminMembership));

        membershipService.transferAdmin(10L, 2L, "admin@test.com");

        assertEquals(member, league.getAdminUser());
        assertEquals("ADMIN", memberMembership.getRole());
        assertEquals("MEMBER", adminMembership.getRole());
    }

    @Test
    @DisplayName("transferAdmin solo lo puede hacer el admin actual")
    void transferAdminRejectsNonAdmin() {
        when(leagueRepository.findById(10L)).thenReturn(Optional.of(league));

        assertThrows(BusinessException.class, () -> membershipService.transferAdmin(10L, 2L, "member@test.com"));

        assertEquals(admin, league.getAdminUser());
    }

    @Test
    @DisplayName("transferAdmin rechaza a quien no es miembro de la liga")
    void transferAdminRejectsNonMember() {
        when(leagueRepository.findById(10L)).thenReturn(Optional.of(league));
        when(membershipRepository.findById(new Membership.MembershipId(3L, 10L))).thenReturn(Optional.empty());

        assertThrows(BusinessException.class, () -> membershipService.transferAdmin(10L, 3L, "admin@test.com"));

        assertEquals(admin, league.getAdminUser());
    }
}
