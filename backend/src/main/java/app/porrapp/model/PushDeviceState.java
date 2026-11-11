package app.porrapp.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import java.time.Instant;
import java.util.UUID;

/** Último permiso comunicado por un navegador, no una garantía de recepción ni de permiso actual. */
@Entity
@Table(name = "push_device_states")
@Getter @NoArgsConstructor
public class PushDeviceState {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private Long userId;
    private UUID deviceId;
    private String permission;
    private boolean installRequired;
    private Instant observedAt;
    private Instant lastPromptAt;
}
