package com.porra.mundial.model;

import jakarta.persistence.*;
import lombok.*;
import java.io.Serializable;
import java.time.LocalDateTime;

@Entity
@Table(name = "memberships")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Membership {

    @EmbeddedId
    private MembershipId id;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("userId")
    @JoinColumn(name = "user_id")
    private UserAccount user;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("leagueId")
    @JoinColumn(name = "league_id")
    private BetGroup league;

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String role = "MEMBER";

    @Builder.Default
    private LocalDateTime joinedAt = LocalDateTime.now();

    @Embeddable
    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @EqualsAndHashCode
    public static class MembershipId implements Serializable {
        private Long userId;
        private Long leagueId;
    }
}
