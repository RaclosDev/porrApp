package com.porra.mundial.model;

import jakarta.persistence.*;
import lombok.*;
import java.io.Serializable;
import java.time.LocalDateTime;

/**
 *  Entidad 'Membership' (Membresía).
 * Tabla intermedia que representa la relación Muchos-a-Muchos entre Usuarios y Grupos.
 * Indica que un usuario pertenece a un grupo específico.
 */
@Entity
@Table(name = "memberships")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Membership {

    /** Identificador compuesto (Usuario ID + Grupo ID). */
    @EmbeddedId
    private MembershipId id;

    /** Relación hacia la entidad del Usuario. */
    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("userId")
    @JoinColumn(name = "user_id")
    private UserAccount user;

    /** Relación hacia la entidad del Grupo. */
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

    /**
     * Clase estática que representa la clave primaria compuesta.
     */
    @Embeddable
    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @EqualsAndHashCode
    public static class MembershipId implements Serializable {
        private Long userId;
        private Long leagueId;
    }
}
