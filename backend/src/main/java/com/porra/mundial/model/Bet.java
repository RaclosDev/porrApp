package com.porra.mundial.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

/**
 *  Entidad 'Bet' (Apuesta / Porra).
 * Representa la cabecera principal de la porra que un usuario envía al servidor. 
 * Está ligada a una edición de un torneo y a una cuenta de usuario.
 * Se guarda en la tabla "bets_v2" de la base de datos.
 */
@Entity
@Table(name = "bets_v2")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Bet {

    /** Identificador único autogenerado de la apuesta. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Usuario (Participante) propietario de esta apuesta. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private UserAccount user;

    /** Edición de la competición (ej. Euro 2024, Mundial 2026) a la que pertenece la apuesta. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "edition_id", nullable = false)
    private Edition edition;

    /** Nombre personalizable que el usuario le puede dar a su porra. */
    private String betName;

    /** Cantidad pagada (o a pagar) si el grupo es de pago. */
    private java.math.BigDecimal paymentAmount;

    /** Estado del pago: PENDING o PAID. Afecta si la apuesta es visible en el ranking. */
    @Column(nullable = false, length = 20)
    @Builder.Default
    private String paymentStatus = "PENDING";

    /** Usuario administrador del grupo que marcó esta apuesta como pagada. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "payment_marked_by")
    private UserAccount paymentMarkedBy;

    /** Fecha exacta en la que se envió o guardó la apuesta. */
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    /** Flag que indica si esta apuesta es el Cuadro Oficial del sistema para evaluar puntuaciones. */
    @Column(name = "is_official", nullable = false)
    @Builder.Default
    private Boolean isOfficial = false;

    // -- HELPER METHODS FOR BACKWARDS COMPATIBILITY --
    
    @Transient
    public String getParticipantName() {
        return user != null ? user.getParticipantName() : null;
    }

    @Transient
    public void setParticipantName(String name) {
        // Will be ignored by DB, needed for builders
    }

    @Transient
    public Long getGroupId() {
        return (edition != null && edition.getLeague() != null) ? edition.getLeague().getId() : null;
    }

    @Transient
    public void setGroupId(Long id) {
        // Will be ignored
    }

    @Transient
    public Boolean getPaid() {
        return "PAID".equals(paymentStatus);
    }

    @Transient
    public void setPaid(Boolean paid) {
        this.paymentStatus = (paid != null && paid) ? "PAID" : "PENDING";
    }
}
