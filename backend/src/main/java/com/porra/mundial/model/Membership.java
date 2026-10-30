package com.porra.mundial.model;

import jakarta.persistence.*;
import lombok.*;
import java.io.Serializable;
import java.time.LocalDateTime;

/** Pertenencia de un usuario a una liga (relación muchos a muchos). */
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
    private League league;

    /** Rol del usuario dentro del grupo (Ej. MEMBER, ADMIN). */
    @Column(nullable = false, length = 20)
    @Builder.Default
    private String role = "MEMBER";

    /** Estado del pago de la cuota en el grupo (PENDING, PAID). */
    @Column(name = "payment_status", length = 20)
    @Builder.Default
    private String paymentStatus = "PENDING";

    /** Fecha en la que el usuario se unió al grupo mediante el código. */
    @Builder.Default
    private LocalDateTime joinedAt = LocalDateTime.now();

    @Embeddable
    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @EqualsAndHashCode
    public static class MembershipId implements Serializable {
        private Long userId;
        private Long leagueId;
    }
}
