package com.porra.mundial.service.league;

import com.porra.mundial.service.notification.WebSocketService;
import com.porra.mundial.model.Membership;
import com.porra.mundial.repository.LeagueRepository;
import com.porra.mundial.repository.MembershipRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.Set;

/** Quién puede recibir los avisos en tiempo real de una liga: todos si es pública, si no sus miembros. */
@Component
@RequiredArgsConstructor
public class LeagueAudienceResolver implements WebSocketService.LeagueAudience {

    private final LeagueRepository leagueRepository;
    private final MembershipRepository membershipRepository;

    @Override
    @Transactional(readOnly = true)
    public WebSocketService.Audience of(Long leagueId) {
        return leagueRepository.findById(leagueId).map(league -> {
            if (league.isPublicLeague()) return WebSocketService.Audience.EVERYONE;
            Set<Long> members = new HashSet<>();
            for (Membership m : membershipRepository.findByLeagueId(leagueId)) {
                if (m.getId() != null && m.getId().getUserId() != null) members.add(m.getId().getUserId());
            }
            if (league.getAdminUser() != null && league.getAdminUser().getId() != null) {
                members.add(league.getAdminUser().getId());
            }
            return new WebSocketService.Audience(false, Set.copyOf(members));
        }).orElse(WebSocketService.Audience.NOBODY);
    }
}
