package com.porra.mundial.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

/**
 * 📅 Entidad 'Edition' (Edición).
 * Es el enlace central que une a un Grupo (BetGroup) con una Competición (Competition).
 * Permite que un mismo grupo ("Los Amigos") juegue múltiples ediciones
 * a lo largo de los años ("Mundial 22", "Euro 24", "Mundial 26") sin perder el grupo.
 */
@Entity
@Table(name = "editions")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Edition {

    /** Identificador autogenerado de la edición del grupo. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** El grupo o liga que está participando. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "league_id", nullable = false)
    private BetGroup league;

    /** La competición física que se está jugando (Eurocopa, Mundial). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "competition_id", nullable = false)
    private Competition competition;

    /** El tipo de formato o reglas con las que juega este grupo esta edición. */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private BetMode betMode;

    /** Estado actual de la edición (ej. ACTIVE, ARCHIVED). */
    @Column(nullable = false, length = 20)
    @Builder.Default
    private String status = "ACTIVE";

    /** Fecha en la que el grupo creó esta edición. */
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    /** Flag indicando si en esta edición se otorgan puntos extra por adivinar al Pichichi. */
    @Builder.Default
    @Column(nullable = false)
    private boolean pichichi = true;
}
