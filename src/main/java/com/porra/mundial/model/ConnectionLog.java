package com.porra.mundial.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@NoArgsConstructor
@Entity
@Table(name = "connection_logs")
public class ConnectionLog {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String participantName;

    @Column(nullable = false)
    private Instant connectedAt;

    public ConnectionLog(String participantName, Instant connectedAt) {
        this.participantName = participantName;
        this.connectedAt = connectedAt;
    }
}
