package com.porra.mundial.service;

import com.porra.mundial.dto.MeResponse;
import com.porra.mundial.model.UserAccount;
import com.porra.mundial.repository.UserAccountRepository;
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

        MeResponse me = new UserService(repository).getMe("ana@test.com");

        assertThat(me.userId()).isEqualTo(42L);
        assertThat(me.participantName()).isEqualTo("Ana");
        assertThat(me.lastSelectedGroupId()).isEqualTo(7L);
        assertThat(me.profileSetupCompleted()).isFalse();
    }

    @Test
    void profileSetupCompletionIsPersistentAndIdempotent() {
        UserAccountRepository repository = mock(UserAccountRepository.class);
        UserAccount user = UserAccount.builder().id(42L).googleEmail("ana@test.com")
                .participantName("Ana").build();
        when(repository.findByGoogleEmail("ana@test.com")).thenReturn(Optional.of(user));
        UserService service = new UserService(repository);

        service.completeProfileSetup("ana@test.com");
        verify(repository).save(user);
        assertThat(service.getMe("ana@test.com").profileSetupCompleted()).isTrue();
        service.completeProfileSetup("ana@test.com");
        assertThat(user.isProfileSetupCompleted()).isTrue();
    }
}
