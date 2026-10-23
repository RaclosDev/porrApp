package com.porra.mundial.service;

import com.porra.mundial.dto.BetDataDTO;
import com.porra.mundial.model.*;
import com.porra.mundial.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.NoSuchElementException;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BetServiceTest {

    @Mock
    private BetRepository betRepository;

    @Mock
    private BetBackupRepository betBackupRepository;

    @Mock
    private UserAccountRepository userAccountRepository;

    @Mock
    private EditionRepository editionRepository;

    @Mock
    private PredictionPersistenceService predictionPersistenceService;

    @Mock
    private MembershipRepository membershipRepository;

    @InjectMocks
    private BetService betService;

    private UserAccount owner;
    private UserAccount groupAdmin;
    private UserAccount stranger;
    private BetGroup group;
    private Edition edition;
    private Bet bet;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(betService, "appAdmins", List.of("Admin", "Raclos"));
        ReflectionTestUtils.setField(betService, "adminEmails", List.of("superadmin@porra.com"));

        owner = UserAccount.builder()
                .id(10L)
                .googleEmail("owner@test.com")
                .participantName("OwnerUser")
                .isSuperadmin(false)
                .build();

        groupAdmin = UserAccount.builder()
                .id(20L)
                .googleEmail("admin@test.com")
                .participantName("GroupAdminUser")
                .isSuperadmin(false)
                .build();

        stranger = UserAccount.builder()
                .id(30L)
                .googleEmail("stranger@test.com")
                .participantName("StrangerUser")
                .isSuperadmin(false)
                .build();

        group = BetGroup.builder()
                .id(100L)
                .name("Liga Amigos")
                .joinCode("AMIGOS")
                .adminUser(groupAdmin)
                .build();

        edition = Edition.builder()
                .id(1L)
                .league(group)
                .status("ACTIVE")
                .build();

        bet = Bet.builder()
                .id(1L)
                .user(owner)
                .edition(edition)
                .betName("Porra Ganadora")
                .paymentStatus("PENDING")
                .build();
    }

    @Test
    @DisplayName("Dueño puede actualizar su propia apuesta")
    void ownerCanUpdateOwnBet() {
        when(betRepository.findById(1L)).thenReturn(Optional.of(bet));
        when(betRepository.save(any(Bet.class))).thenAnswer(inv -> inv.getArgument(0));

        Bet updated = betService.updateBet(1L, "owner@test.com", "OwnerUser", "Nuevo Nombre", null);

        assertNotNull(updated);
        assertEquals("Nuevo Nombre", updated.getBetName());
        verify(betRepository).save(bet);
    }

    @Test
    @DisplayName("Admin del grupo puede actualizar la apuesta de un miembro")
    void groupAdminCanUpdateMemberBet() {
        when(betRepository.findById(1L)).thenReturn(Optional.of(bet));
        when(betRepository.save(any(Bet.class))).thenAnswer(inv -> inv.getArgument(0));

        Bet updated = betService.updateBet(1L, "admin@test.com", "OwnerUser", "Corregido por Admin", null);

        assertNotNull(updated);
        assertEquals("Corregido por Admin", updated.getBetName());
    }

    @Test
    @DisplayName("Superadmin global puede actualizar cualquier apuesta")
    void superAdminCanUpdateAnyBet() {
        when(betRepository.findById(1L)).thenReturn(Optional.of(bet));
        when(betRepository.save(any(Bet.class))).thenAnswer(inv -> inv.getArgument(0));

        Bet updated = betService.updateBet(1L, "superadmin@porra.com", "OwnerUser", "Porra Superadmin", null);

        assertNotNull(updated);
        assertEquals("Porra Superadmin", updated.getBetName());
    }

    @Test
    @DisplayName("Extraño NO puede actualizar la apuesta de otro usuario (403 SecurityException)")
    void strangerCannotUpdateBet() {
        when(betRepository.findById(1L)).thenReturn(Optional.of(bet));

        assertThrows(SecurityException.class, () ->
                betService.updateBet(1L, "stranger@test.com", "Hacker", "Robada", null)
        );

        verify(betRepository, never()).save(any());
    }

    @Test
    @DisplayName("Usuario no autenticado (email null) es rechazado")
    void unauthenticatedCannotUpdateBet() {
        when(betRepository.findById(1L)).thenReturn(Optional.of(bet));

        assertThrows(SecurityException.class, () ->
                betService.updateBet(1L, null, "User", "Sin Auth", null)
        );
    }

    @Test
    @DisplayName("Participante normal NO puede marcar su propia apuesta como pagada")
    void ownerCannotMarkOwnBetAsPaid() {
        when(betRepository.findById(1L)).thenReturn(Optional.of(bet));

        assertThrows(SecurityException.class, () ->
                betService.markAsPaid(1L, "owner@test.com")
        );

        assertFalse(bet.getPaid());
        verify(betRepository, never()).save(any());
    }

    @Test
    @DisplayName("Admin del grupo sí puede marcar la apuesta de un miembro como pagada")
    void groupAdminCanMarkBetAsPaid() {
        when(betRepository.findById(1L)).thenReturn(Optional.of(bet));
        when(betRepository.save(any(Bet.class))).thenAnswer(inv -> inv.getArgument(0));
        when(userAccountRepository.findByGoogleEmail("admin@test.com")).thenReturn(Optional.of(groupAdmin));

        Bet paidBet = betService.markAsPaid(1L, "admin@test.com");

        assertTrue(paidBet.getPaid());
        assertEquals(groupAdmin, paidBet.getPaymentMarkedBy());
        verify(betRepository).save(bet);
    }

    @Test
    @DisplayName("Dueño puede borrar su propia apuesta")
    void ownerCanDeleteOwnBet() {
        when(betRepository.findById(1L)).thenReturn(Optional.of(bet));

        betService.deleteBet(1L, "owner@test.com");

        verify(betRepository).delete(bet);
    }

    @Test
    @DisplayName("Extraño NO puede borrar la apuesta de otro usuario")
    void strangerCannotDeleteBet() {
        when(betRepository.findById(1L)).thenReturn(Optional.of(bet));

        assertThrows(SecurityException.class, () ->
                betService.deleteBet(1L, "stranger@test.com")
        );

        verify(betRepository, never()).delete(any());
    }
}
