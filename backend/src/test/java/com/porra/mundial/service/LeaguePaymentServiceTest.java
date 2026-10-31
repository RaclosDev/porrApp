package com.porra.mundial.service;

import com.porra.mundial.model.Membership;
import com.porra.mundial.model.Prediction;
import com.porra.mundial.model.UserAccount;
import com.porra.mundial.repository.MembershipRepository;
import com.porra.mundial.repository.PredictionRepository;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

class LeaguePaymentServiceTest {
    @Test
    void paymentAndReversalUpdateMembershipAndEveryEditionTogether() {
        var memberships = mock(MembershipRepository.class);
        var predictions = mock(PredictionRepository.class);
        var member = Membership.builder().paymentStatus("PENDING").build();
        var first = Prediction.builder().paymentStatus("PENDING").build();
        var second = Prediction.builder().paymentStatus("PENDING").build();
        var admin = UserAccount.builder().id(1L).build();
        when(memberships.findById(new Membership.MembershipId(2L, 3L))).thenReturn(Optional.of(member));
        when(predictions.findByUserIdAndEditionLeagueId(2L, 3L)).thenReturn(List.of(first, second));
        var service = new LeaguePaymentService(memberships, predictions);

        service.setPayment(3L, 2L, "PAID", admin);

        assertThat(member.getPaymentStatus()).isEqualTo("PAID");
        assertThat(first.getPaid()).isTrue();
        assertThat(second.getPaid()).isTrue();
        assertThat(first.getPaymentMarkedBy()).isSameAs(admin);

        service.setPayment(3L, 2L, "PENDING", admin);

        assertThat(member.getPaymentStatus()).isEqualTo("PENDING");
        assertThat(first.getPaid()).isFalse();
        assertThat(second.getPaid()).isFalse();
        verify(memberships, times(2)).save(member);
        verify(predictions, times(2)).save(first);
        verify(predictions, times(2)).save(second);
    }

    @Test
    void missingMembershipDoesNotWritePredictions() {
        var memberships = mock(MembershipRepository.class);
        var predictions = mock(PredictionRepository.class);
        var service = new LeaguePaymentService(memberships, predictions);
        assertThatThrownBy(() -> service.setPayment(3L, 2L, "PAID", null))
                .isInstanceOf(java.util.NoSuchElementException.class);
        verifyNoInteractions(predictions);
    }
}
