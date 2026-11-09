package app.porrapp.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * Entidad 'League' (Liga / Grupo Privado).
 * Representa una liga o comunidad de participantes (amigos, empresa, familia).
 * Cada liga cuenta con un administrador, un código único de invitación y participa
 * en una o más ediciones de torneos.
 * Se almacena en la tabla "leagues".
 */
@Entity
@Table(name = "leagues")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class League {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Nombre visible de la liga. Ej: "Los Amigos del Barrio", "Oficina Euro 2024". */
    @Column(nullable = false)
    private String name;

    /** Código alfanumérico único para unirse a la liga. */
    @Column(nullable = false, unique = true, length = 10)
    private String joinCode;

    /** Usuario que creó la liga y que actúa como administrador de la misma. */
    @com.fasterxml.jackson.annotation.JsonIgnore
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "admin_user_id", nullable = false)
    private UserAccount adminUser;

    /**
     * Liga pública: cualquiera puede ver su clasificación, sus miembros (sin emails) y sus
     * pronósticos, y participar sin código de invitación.
     */
    @Builder.Default
    @Column(name = "is_public", nullable = false)
    private boolean publicLeague = false;

    /** Liga con cuota de inscripción: la clasificación marca a quien no ha pagado. */
    @Builder.Default
    @Column(name = "entry_fee", nullable = false)
    private boolean entryFee = false;

    @Builder.Default
    private Instant createdAt = Instant.now();

    /** Clave de idempotencia con la que se creó la liga (única por administrador). */
    @com.fasterxml.jackson.annotation.JsonIgnore
    @Column(name = "creation_key", length = 64)
    private String creationKey;

    /** Reglas personalizadas de la liga (texto libre definido por el admin). */
    @Column(columnDefinition = "TEXT")
    private String rules;

    /** Momento de la última subida de imagen. Null si la liga no tiene imagen. Sirve para versionar la URL. */
    @Column(name = "image_updated_at")
    private Instant imageUpdatedAt;

    /** Clave aleatoria de la URL de la imagen; cambia en cada subida. */
    @Column(name = "image_key", length = 32)
    private String imageKey;

    @Transient
    public String getAdminParticipantName() {
        return adminUser != null ? adminUser.getParticipantName() : null;
    }

    /** URL no adivinable de la imagen de la liga, o null si no tiene. */
    @com.fasterxml.jackson.annotation.JsonProperty("imageUrl")
    @Transient
    public String getImageUrl() {
        if (id == null || imageUpdatedAt == null || imageKey == null) return null;
        return "/api/groups/" + id + "/image/" + imageKey;
    }

    @com.fasterxml.jackson.annotation.JsonProperty("adminUserId")
    @Transient
    public Long getAdminUserId() {
        return adminUser != null ? adminUser.getId() : null;
    }
}
