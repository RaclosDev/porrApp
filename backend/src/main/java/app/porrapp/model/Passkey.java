package app.porrapp.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * Llave de acceso (WebAuthn) de una cuenta: permite entrar con Face ID, huella o el PIN del
 * dispositivo. Solo se guarda la clave pública; la privada nunca sale del dispositivo.
 */
@Entity
@Table(name = "passkeys")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Passkey {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "credential_id", nullable = false, unique = true)
    private byte[] credentialId;

    /** Identificador aleatorio de la cuenta para el autenticador; el mismo en todas sus llaves. */
    @Column(name = "user_handle", nullable = false)
    private byte[] userHandle;

    @Column(name = "public_key_cose", nullable = false)
    private byte[] publicKeyCose;

    @Column(name = "signature_count", nullable = false)
    private long signatureCount;

    @Column(nullable = false, length = 60)
    private String name;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "last_used_at")
    private Instant lastUsedAt;
}
