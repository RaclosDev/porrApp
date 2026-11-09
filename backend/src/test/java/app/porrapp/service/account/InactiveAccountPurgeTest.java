package app.porrapp.service.account;

import app.porrapp.repository.UserAccountRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;

import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class InactiveAccountPurgeTest {

    @Mock private UserAccountRepository userAccountRepository;
    @Mock private AccountDeletionService accountDeletionService;

    @InjectMocks private InactiveAccountPurge purge;

    @Test
    void deletesAccountsInactiveFor24MonthsAndKeepsGoingAfterAFailure() {
        purge.setClock(Clock.fixed(Instant.parse("2028-11-06T03:45:00Z"), ZoneOffset.UTC));
        when(userAccountRepository.findIdsInactiveSince(Instant.parse("2026-11-06T03:45:00Z")))
                .thenReturn(List.of(3L, 4L));
        doThrow(new IllegalStateException("bloqueo")).when(accountDeletionService).deleteInactiveAccount(3L);

        purge.purgeInactiveAccounts();

        verify(accountDeletionService).deleteInactiveAccount(3L);
        verify(accountDeletionService).deleteInactiveAccount(4L);
    }
}
