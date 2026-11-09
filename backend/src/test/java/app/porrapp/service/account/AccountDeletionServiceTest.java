package app.porrapp.service.account;

import app.porrapp.service.league.LeagueService;
import app.porrapp.service.league.LeagueMembershipService;
import app.porrapp.exception.BusinessException;
import app.porrapp.model.League;
import app.porrapp.model.Membership;
import app.porrapp.model.Prediction;
import app.porrapp.model.UserAccount;
import app.porrapp.repository.LeagueRepository;
import app.porrapp.repository.MembershipRepository;
import app.porrapp.repository.PredictionRepository;
import app.porrapp.repository.UserAccountRepository;
import app.porrapp.util.AppTime;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AccountDeletionServiceTest {

    @Mock private UserAccountRepository userAccountRepository;
    @Mock private LeagueRepository leagueRepository;
    @Mock private MembershipRepository membershipRepository;
    @Mock private PredictionRepository predictionRepository;
    @Mock private LeagueService leagueService;
    @Mock private LeagueMembershipService membershipService;

    @InjectMocks private AccountDeletionService service;

    private UserAccount user;

    @BeforeEach
    void setUp() {
        user = UserAccount.builder().id(7L).googleEmail("yo@test.com").participantName("Yo").build();
        lenient().when(userAccountRepository.findByGoogleEmail("yo@test.com")).thenReturn(Optional.of(user));
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
        verify(leagueService, never()).deleteLeague(anyLong(), anyString());
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

        verify(leagueService).deleteLeague(2L, "yo@test.com");
        verify(userAccountRepository).delete(user);
    }

    private Membership member(Long userId, Long leagueId, Instant joinedAt) {
        return Membership.builder()
                .id(new Membership.MembershipId(userId, leagueId))
                .user(UserAccount.builder().id(userId).build())
                .joinedAt(joinedAt)
                .build();
    }

    @Test
    void inactiveAccountHandsSharedLeaguesToTheOldestMemberAndDeletesTheRest() {
        League shared = League.builder().id(1L).name("Los del curro").adminUser(user).build();
        League solo = League.builder().id(2L).name("Solo yo").adminUser(user).build();
        Instant start = AppTime.fromLocal(LocalDateTime.of(2026, 1, 1, 12, 0));
        when(userAccountRepository.findById(7L)).thenReturn(Optional.of(user));
        when(leagueRepository.findByAdminUserId(7L)).thenReturn(List.of(shared, solo));
        when(membershipRepository.findByLeagueId(1L)).thenReturn(List.of(
                member(7L, 1L, start), member(9L, 1L, start.plus(5, ChronoUnit.DAYS)), member(8L, 1L, start.plus(2, ChronoUnit.DAYS))));
        when(membershipRepository.findByLeagueId(2L)).thenReturn(List.of(member(7L, 2L, start)));

        service.deleteInactiveAccount(7L);

        verify(membershipService).transferAdmin(1L, 8L, "yo@test.com");
        verify(leagueService).deleteLeague(2L, "yo@test.com");
        verify(leagueService, never()).deleteLeague(eq(1L), anyString());
        verify(userAccountRepository).delete(user);
    }

    @Test
    void inactiveAccountAlreadyGoneIsIgnored() {
        when(userAccountRepository.findById(7L)).thenReturn(Optional.empty());

        service.deleteInactiveAccount(7L);

        verify(userAccountRepository, never()).delete(any());
    }
}
