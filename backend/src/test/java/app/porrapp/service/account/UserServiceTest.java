package app.porrapp.service.account;

import app.porrapp.dto.MeResponse;
import app.porrapp.model.UserAccount;
import app.porrapp.repository.UserAccountRepository;
import app.porrapp.service.admin.AdminAccess;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;

class UserServiceTest {

    @Test
    void meIncludesTheUserId() {
        UserAccountRepository repository = mock(UserAccountRepository.class);
        when(repository.findByGoogleEmail("ana@test.com")).thenReturn(Optional.of(UserAccount.builder()
                .id(42L).googleEmail("ana@test.com").participantName("Ana").lastSelectedGroupId(7L).build()));

        MeResponse me = new UserService(repository, mock(AdminAccess.class)).getMe("ana@test.com");

        assertThat(me.userId()).isEqualTo(42L);
        assertThat(me.participantName()).isEqualTo("Ana");
        assertThat(me.lastSelectedGroupId()).isEqualTo(7L);
        assertThat(me.profileSetupCompleted()).isFalse();
        assertThat(me.admin()).isFalse();
    }

    @Test
    void meFlagsTheAdminAccount() {
        UserAccountRepository repository = mock(UserAccountRepository.class);
        AdminAccess access = mock(AdminAccess.class);
        when(repository.findByGoogleEmail("boss@test.com")).thenReturn(Optional.of(UserAccount.builder()
                .id(1L).googleEmail("boss@test.com").participantName("Boss").build()));
        when(access.isAdmin("boss@test.com")).thenReturn(true);

        assertThat(new UserService(repository, access).getMe("boss@test.com").admin()).isTrue();
    }

    @Test
    void profileSetupCompletionIsPersistentAndIdempotent() {
        UserAccountRepository repository = mock(UserAccountRepository.class);
        UserAccount user = UserAccount.builder().id(42L).googleEmail("ana@test.com")
                .participantName("Ana").build();
        when(repository.findByGoogleEmail("ana@test.com")).thenReturn(Optional.of(user));
        UserService service = new UserService(repository, mock(AdminAccess.class));

        service.completeProfileSetup("ana@test.com");
        verify(repository).save(user);
        assertThat(service.getMe("ana@test.com").profileSetupCompleted()).isTrue();
        service.completeProfileSetup("ana@test.com");
        assertThat(user.isProfileSetupCompleted()).isTrue();
    }
}
