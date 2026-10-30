package com.porra.mundial.model;

import com.porra.mundial.dto.PredictionDataDTO;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

/**
 * Entidad 'Prediction' (Pronostico / Porra).
 * Representa la cabecera principal de la porra que un usuario envia al servidor.
 * Esta ligada a una edicion de un torneo y a una cuenta de usuario.
 * Se guarda en la tabla "predictions" de la base de datos con puntuaciones materializadas.
 */
@Entity
@Table(name = "predictions", uniqueConstraints = {
    @UniqueConstraint(name = "uq_predictions_user_edition", columnNames = {"user_id", "edition_id"})
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Prediction {

    /** Identificador unico autogenerado del pronostico. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Usuario (Participante) propietario de este pronostico. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private UserAccount user;

    /** Edicion de la competicion a la que pertenece el pronostico. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "edition_id", nullable = false)
    private Edition edition;

    /** Nombre personalizable del pronostico (ej: 'Mi Porra 1'). */
    @Column(name = "prediction_name")
    private String name;

    /** Cantidad pagada (o a pagar) si el grupo es de pago. */
    private java.math.BigDecimal paymentAmount;

    /** Estado del pago: PENDING o PAID. Afecta si el pronostico es visible en el ranking. */
    @Column(nullable = false, length = 20)
    @Builder.Default
    private String paymentStatus = "PENDING";

    /** Usuario administrador del grupo que marco este pronostico como pagado. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "payment_marked_by")
    private UserAccount paymentMarkedBy;

    /** Fecha exacta en la que se envio o guardo el pronostico. */
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    /** Flag que indica si este pronostico es el Cuadro Oficial del sistema. */
    @Column(name = "is_official", nullable = false)
    @Builder.Default
    private Boolean isOfficial = false;

    /** Datos estructurados del pronóstico completo del cuadro (fase de grupos, eliminatorias, campeón, pichichi). */
    @Convert(converter = PredictionDataConverter.class)
    @Column(name = "bracket_data", columnDefinition = "TEXT")
    private PredictionDataDTO bracketData;

    /* --- PUNTUACIONES MATERIALIZADAS (Evita N+1 y recálculo en cada GET /api/leaderboard) --- */

    @Column(name = "total_points")
    @Builder.Default
    private Integer totalPoints = 0;

    @Column(name = "r1_points")
    @Builder.Default
    private Integer r1Points = 0;

    @Column(name = "r32_points")
    @Builder.Default
    private Integer r32Points = 0;

    @Column(name = "r16_points")
    @Builder.Default
    private Integer r16Points = 0;

    @Column(name = "qf_points")
    @Builder.Default
    private Integer qfPoints = 0;

    @Column(name = "sf_points")
    @Builder.Default
    private Integer sfPoints = 0;

    @Column(name = "finals_points")
    @Builder.Default
    private Integer finalsPoints = 0;

    @Column(name = "scorer_points")
    @Builder.Default
    private Integer scorerPoints = 0;

    @Column(name = "match_points")
    @Builder.Default
    private Integer matchPoints = 0;

    @Column(name = "score_calculated_at")
    private LocalDateTime scoreCalculatedAt;

    public boolean isOfficial() {
        return Boolean.TRUE.equals(isOfficial);
    }

    public String getPredictionName() {
        return name;
    }

    public void setPredictionName(String predictionName) {
        this.name = predictionName;
    }

    @Transient
    public String getParticipantName() {
        return user != null ? user.getParticipantName() : null;
    }

    @Transient
    public void setParticipantName(String name) {
        // Ignored by DB
    }

    @Transient
    public Long getGroupId() {
        return (edition != null && edition.getLeague() != null) ? edition.getLeague().getId() : null;
    }

    @Transient
    public void setGroupId(Long id) {
        // Ignored
    }

    @Transient
    public Boolean getPaid() {
        return "PAID".equals(paymentStatus);
    }

    @Transient
    public void setPaid(Boolean paid) {
        this.paymentStatus = (paid != null && paid) ? "PAID" : "PENDING";
    }

    public static class PredictionBuilder {

        public PredictionBuilder predictionName(String predictionName) {
            this.name = predictionName;
            return this;
        }
    }
}
