package com.porra.mundial.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

/**
 *  Entidad 'Edition' (Edición).
 * Es el enlace central que une a una Liga (League) con una Competición (Competition).
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

    /** La liga que está participando. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "league_id", nullable = false)
    private League league;

    /** La competición física que se está jugando (Eurocopa, Mundial). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "competition_id", nullable = false)
    private Competition competition;

    /** El formato de la porra o reglas con las que juega este grupo esta edición. */
    @Enumerated(EnumType.STRING)
    @Column(name = "bet_mode", nullable = false, length = 50)
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

    // Métodos de compatibilidad hacia atrás para betMode

    public PoolFormat getBetMode() {
        return poolFormat != null ? poolFormat : PoolFormat.FULL_BRACKET;
    }

    public void setBetMode(PoolFormat format) {
        this.poolFormat = format;
    }

    public void setBetMode(BetMode legacyMode) {
        this.poolFormat = legacyMode != null ? legacyMode.toPoolFormat() : PoolFormat.FULL_BRACKET;
    }

    public static class EditionBuilder {
        public EditionBuilder betMode(BetMode mode) {
            this.poolFormat = mode != null ? mode.toPoolFormat() : PoolFormat.FULL_BRACKET;
            return this;
        }

        public EditionBuilder betMode(PoolFormat format) {
            this.poolFormat = format;
            return this;
        }
    }
}
