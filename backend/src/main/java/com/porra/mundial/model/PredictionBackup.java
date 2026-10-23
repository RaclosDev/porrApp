package com.porra.mundial.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

/**
 * Entidad 'PredictionBackup' (Copia de seguridad y auditoria de pronosticos).
 */
@Entity
@Table(name = "prediction_backups")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PredictionBackup {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "original_prediction_id", nullable = false)
    private Long originalPredictionId;

    private String participantName;

    @Column(name = "prediction_name")
    private String predictionName;

    private Boolean paid;

    @Column(nullable = false)
    private String action;

    @Builder.Default
    private LocalDateTime backupTimestamp = LocalDateTime.now();

    public Long getOriginalBetId() {
        return originalPredictionId;
    }

    public void setOriginalBetId(Long id) {
        this.originalPredictionId = id;
    }

    public String getBetName() {
        return predictionName;
    }

    public void setBetName(String name) {
        this.predictionName = name;
    }

    public static class PredictionBackupBuilder {
        public PredictionBackupBuilder originalBetId(Long id) {
            this.originalPredictionId = id;
            return this;
        }

        public PredictionBackupBuilder betName(String name) {
            this.predictionName = name;
            return this;
        }
    }
}
