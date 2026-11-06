package com.porra.mundial.service.league;

import com.porra.mundial.service.notification.WebSocketService;
import com.porra.mundial.model.League;
import com.porra.mundial.model.Membership;
import com.porra.mundial.model.UserAccount;
import com.porra.mundial.repository.LeagueRepository;
import com.porra.mundial.repository.MembershipRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/** Los avisos en tiempo real de una liga privada solo llegan a sus miembros y a su admin. */
@ExtendWith(MockitoExtension.class)
class LeagueAudienceResolverTest {

    @Mock private LeagueRepository leagues;
    @Mock private MembershipRepository memberships;
    @InjectMocks private LeagueAudienceResolver resolver;

    @Test
    void publicLeaguesReachEveryone() {
        when(leagues.findById(1L)).thenReturn(Optional.of(League.builder().id(1L).publicLeague(true).build()));

        assertThat(resolver.of(1L)).isEqualTo(WebSocketService.Audience.EVERYONE);
        verifyNoInteractions(memberships);
    }

    @Test
    void privateLeaguesReachOnlyMembersAndTheAdmin() {
        League league = League.builder().id(2L).adminUser(UserAccount.builder().id(9L).build()).build();
        when(leagues.findById(2L)).thenReturn(Optional.of(league));
        when(memberships.findByLeagueId(2L)).thenReturn(List.of(member(3L, 2L), member(4L, 2L),
                Membership.builder().id(new Membership.MembershipId(null, 2L)).build()));

        WebSocketService.Audience audience = resolver.of(2L);

        assertThat(audience.everyone()).isFalse();
        assertThat(audience.userIds()).isEqualTo(Set.of(3L, 4L, 9L));
    }

    @Test
    void unknownLeaguesReachNobody() {
        when(leagues.findById(5L)).thenReturn(Optional.empty());

        assertThat(resolver.of(5L)).isEqualTo(WebSocketService.Audience.NOBODY);
    }

    private static Membership member(Long userId, Long leagueId) {
        return Membership.builder().id(new Membership.MembershipId(userId, leagueId)).build();
    }
}
