package app.porrapp.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * Enlace de un solo uso para poner una contraseña nueva, enviado por correo. Solo se guarda el
 * SHA-256 del token; se borra al usarlo.
 */
@Entity
@Table(name = "password_reset_tokens")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PasswordResetToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "token_hash", nullable = false, unique = true, length = 64)
    private String tokenHash;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;
}
