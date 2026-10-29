package com.porra.mundial.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Entidad 'UserAccount'.
 * Guarda la relación entre una cuenta de Google (email) y el nombre de participante en la porra.
 * Esto evita suplantaciones de identidad y permite el SSO seguro.
 */
@Entity
@Table(name = "app_users")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class UserAccount {

    /**
     * Cuenta interna "Admin" que crea {@code GroupService.initDefaultGroup}. Ningún login de
     * Google puede devolver este email, así que solo el servidor actúa en su nombre.
     */
    public static final String SYSTEM_ADMIN_EMAIL = "admin@local";

    /** Identificador autogenerado del usuario en la base de datos. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** El email verificado de Google de la persona (Ej: raclo@gmail.com). */
    @Column(nullable = false, unique = true)
    private String googleEmail;

    /** El nombre real que tiene configurado en su cuenta de Google. */
    private String googleName;

    /** El apodo o nombre visible con el que se identifica en el ranking y grupos (Ej: "Raclos"). */
    @Column(nullable = false)
    private String participantName;

    /** Fecha y hora en la que se registró por primera vez en la aplicación. */
    @Builder.Default
    private LocalDateTime linkedAt = LocalDateTime.now();

    /** 
     * ID del último grupo que tuvo seleccionado en el frontend.
     * Sirve para recordar sus preferencias al hacer F5 y que no se cambie de grupo.
     */
    @Column(name = "last_selected_group_id")
    private Long lastSelectedGroupId;

    /** Momento de la última subida de foto de perfil. Null si no tiene foto. Sirve para versionar la URL. */
    @Column(name = "avatar_updated_at")
    private LocalDateTime avatarUpdatedAt;

    /** URL pública (versionada) de la foto de perfil, o null si no tiene. */
    @Transient
    public String getAvatarUrl() {
        if (id == null || avatarUpdatedAt == null) return null;
        return "/api/users/" + id + "/avatar?v=" + avatarUpdatedAt.toInstant(java.time.ZoneOffset.UTC).toEpochMilli();
    }
}
