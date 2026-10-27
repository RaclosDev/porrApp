package com.porra.mundial.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Foto de perfil de un usuario de la aplicación. Es independiente de la identidad de Google:
 * no modifica el email ni el nombre de Google de la cuenta.
 */
@Entity
@Table(name = "user_avatars")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class UserAvatar {

    @Id
    @Column(name = "user_id")
    private Long userId;

    @Column(name = "content_type", nullable = false, length = 50)
    private String contentType;

    @Column(name = "data", nullable = false)
    private byte[] data;

    @Column(name = "size_bytes", nullable = false)
    private int sizeBytes;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
