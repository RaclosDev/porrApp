package com.porra.mundial.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

/**
 * 🗄️ Entidad 'BetBackup' (Copia de Seguridad de Apuesta)
 * Actúa como una caja negra / historial de auditoría.
 */
@Entity
@Table(name = "bet_backups")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class BetBackup {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long originalBetId;

    private String participantName;
    private String betName;

    @Column(columnDefinition = "TEXT")
    private String hash;

    private Boolean paid;

    // Acción que provocó el backup: CREATED, UPDATED, DELETED, PAID
    @Column(nullable = false)
    private String action;

    @Builder.Default
    private LocalDateTime backupTimestamp = LocalDateTime.now();
}
