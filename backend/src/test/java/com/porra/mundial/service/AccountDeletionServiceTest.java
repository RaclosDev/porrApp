package com.porra.mundial.service;

import com.porra.mundial.exception.BusinessException;
import com.porra.mundial.model.League;
import com.porra.mundial.model.Membership;
import com.porra.mundial.model.Prediction;
import com.porra.mundial.model.UserAccount;
import com.porra.mundial.repository.LeagueRepository;
import com.porra.mundial.repository.MembershipRepository;
import com.porra.mundial.repository.PredictionRepository;
import com.porra.mundial.repository.UserAccountRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AccountDeletionServiceTest {

    @Mock private UserAccountRepository userAccountRepository;
    @Mock private LeagueRepository leagueRepository;
    @Mock private MembershipRepository membershipRepository;
    @Mock private PredictionRepository predictionRepository;
    @Mock private GroupService groupService;

    @InjectMocks private AccountDeletionService service;

    private UserAccount user;

    @BeforeEach
    void setUp() {
        user = UserAccount.builder().id(7L).googleEmail("yo@test.com").participantName("Yo").build();
        when(userAccountRepository.findByGoogleEmail("yo@test.com")).thenReturn(Optional.of(user));
    }

    @Test
    void deletesPredictionsMembershipsAndTheAccount() {
        Prediction prediction = new Prediction();
        Membership membership = Membership.builder().user(user).build();
        when(leagueRepository.findByAdminUserId(7L)).thenReturn(List.of());
        when(predictionRepository.findByUserId(7L)).thenReturn(List.of(prediction));
        when(membershipRepository.findByUserId(7L)).thenReturn(List.of(membership));

        service.deleteAccount("yo@test.com");

        InOrder order = inOrder(predictionRepository, membershipRepository, userAccountRepository);
        order.verify(predictionRepository).clearPaymentMarkedBy(7L);
        order.verify(predictionRepository).deleteAll(List.of(prediction));
        order.verify(membershipRepository).deleteAll(List.of(membership));
        order.verify(userAccountRepository).delete(user);
        verify(groupService, never()).deleteGroup(anyLong(), anyString());
    }

    @Test
    void refusesWhileAdministeringALeagueWithOtherMembers() {
        League shared = League.builder().id(1L).name("Los del curro").adminUser(user).build();
        when(leagueRepository.findByAdminUserId(7L)).thenReturn(List.of(shared));
        when(membershipRepository.countByLeagueId(1L)).thenReturn(3L);

        BusinessException error = assertThrows(BusinessException.class, () -> service.deleteAccount("yo@test.com"));

        assertTrue(error.getMessage().contains("Los del curro"));
        verify(userAccountRepository, never()).delete(any());
        verify(predictionRepository, never()).clearPaymentMarkedBy(anyLong());
    }

    @Test
    void deletesLeaguesWhereTheUserIsTheOnlyMember() {
        League solo = League.builder().id(2L).name("Solo yo").adminUser(user).build();
        when(leagueRepository.findByAdminUserId(7L)).thenReturn(List.of(solo));
        when(membershipRepository.countByLeagueId(2L)).thenReturn(1L);

        service.deleteAccount("yo@test.com");

        verify(groupService).deleteGroup(2L, "yo@test.com");
        verify(userAccountRepository).delete(user);
    }
}
