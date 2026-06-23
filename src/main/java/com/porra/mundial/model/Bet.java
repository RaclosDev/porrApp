package com.porra.mundial.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

/**
 * 📝 Entidad 'Bet' (Apuesta / Porra)
 * Representa la porra que un usuario envía al servidor. 
 * Se guarda en la tabla "bets" de la base de datos.
 */
@Entity
@Table(name = "bets_v2")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Bet {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private UserAccount user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "edition_id", nullable = false)
    private Edition edition;

    private String betName;

    private java.math.BigDecimal paymentAmount;

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String paymentStatus = "PENDING";

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "payment_marked_by")
    private UserAccount paymentMarkedBy;

    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

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
