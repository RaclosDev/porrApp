package app.porrapp.service.admin;

import app.porrapp.model.UserAccount;
import app.porrapp.repository.UserAccountRepository;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AdminAccessTest {

    private final UserAccountRepository users = Mockito.mock(UserAccountRepository.class);

    private void account(String email, String googleSub, String appleSub) {
        Mockito.when(users.findByGoogleEmail(email)).thenReturn(Optional.of(
                UserAccount.builder().googleEmail(email).googleSub(googleSub).appleSub(appleSub)
                        .participantName("x").build()));
    }

    @Test
    void verifiedAdminEmailIsAllowedIgnoringCaseAndSpaces() {
        account("Boss@Example.com", "sub-1", null);
        AdminAccess access = new AdminAccess(" boss@example.com , otro@example.com", users);

        assertThatCode(() -> access.requireAdmin("Boss@Example.com")).doesNotThrowAnyException();
    }

    @Test
    void otherAccountsAndAnonymousGetNotFound() {
        account("user@example.com", "sub-2", null);
        AdminAccess access = new AdminAccess("boss@example.com", users);

        assertThatThrownBy(() -> access.requireAdmin("user@example.com"))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getStatusCode().value()).isEqualTo(404));
        assertThatThrownBy(() -> access.requireAdmin(null)).isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void passwordAccountWithAnAdminEmailIsRejectedBecauseItIsNotVerified() {
        account("boss@example.com", null, null);
        AdminAccess access = new AdminAccess("boss@example.com", users);

        assertThatThrownBy(() -> access.requireAdmin("boss@example.com"))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void nobodyGetsInWithoutConfiguration() {
        account("boss@example.com", "sub-1", null);
        AdminAccess access = new AdminAccess("", users);

        assertThatThrownBy(() -> access.requireAdmin("boss@example.com"))
                .isInstanceOf(ResponseStatusException.class);
    }
}
