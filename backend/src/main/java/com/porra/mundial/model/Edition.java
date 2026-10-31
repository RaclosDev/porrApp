package com.porra.mundial.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

/** Une una liga con una competición; una liga puede tener varias ediciones. */
@Entity
@Table(name = "editions")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Edition {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "league_id", nullable = false)
    private League league;

    /** La competición física que se está jugando (Eurocopa, Mundial). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "competition_id", nullable = false)
    private Competition competition;

    /** El formato de la porra o reglas con las que juega este grupo esta edicion. */
    @Enumerated(EnumType.STRING)
    @Column(name = "pool_format", nullable = false, length = 50)
    private PoolFormat poolFormat;

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

    /** Fecha y hora límite para enviar o editar pronósticos. */
    @Column(name = "lock_date")
    private LocalDateTime lockDate;

    /** Configuración serializada de reglas de puntuación para esta edición. */
    @Column(name = "scoring_rules_json", columnDefinition = "TEXT")
    private String scoringRulesJson;

    /**
     * Comprueba si la edición/porra se encuentra bloqueada para nuevos envíos o cambios.
     */
    public boolean isLocked() {
        if (!"ACTIVE".equalsIgnoreCase(status)) {
            return true;
        }
        return lockDate != null && LocalDateTime.now().isAfter(lockDate);
    }

}
