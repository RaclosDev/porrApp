package com.porra.mundial.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Entidad de Registro y Auditoría de Sincronizaciones Deportivas (Fase 4).
 * Mantiene la trazabilidad histórica de cada fetch realizado a proveedores deportivos.
 */
@Entity
@Table(name = "sync_audit_logs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SyncAuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 50)
    private String provider;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "competition_id")
    private Competition competition;

    @Column(nullable = false, length = 20)
    private String status; // SUCCESS, ERROR, PARTIAL

    @Builder.Default
    private Integer matchesUpdated = 0;

    @Builder.Default
    private Integer teamsUpdated = 0;

    @Builder.Default
    private Long durationMs = 0L;

    @Column(columnDefinition = "TEXT")
    private String errorMessage;

    @Builder.Default
    private LocalDateTime syncedAt = LocalDateTime.now();
}
