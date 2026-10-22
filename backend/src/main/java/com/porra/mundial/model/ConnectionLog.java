package com.porra.mundial.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * ️‍️ Entidad 'ConnectionLog' (Registro de Conexión).
 * Guarda un registro histórico de cuándo se conectó un usuario a la aplicación.
 * Útil para analíticas o para saber si un usuario del grupo entra mucho a espiar.
 */
@Data
@NoArgsConstructor
@Entity
@Table(name = "connection_logs")
public class ConnectionLog {
    
    /** Identificador de log. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Nombre del participante que se conectó. */
    @Column(nullable = false)
    private String participantName;

    /** Momento exacto de la conexión. */
    @Column(nullable = false)
    private Instant connectedAt;

    public ConnectionLog(String participantName, Instant connectedAt) {
        this.participantName = participantName;
        this.connectedAt = connectedAt;
    }
}
