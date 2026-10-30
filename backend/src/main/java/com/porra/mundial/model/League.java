package com.porra.mundial.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

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

    /**
     * La Porra Global es la liga pública por defecto (demo, entrada desde LinkedIn y usuarios sin liga).
     * {@code GroupService#initDefaultGroup} garantiza al arrancar que existe con este id y este código.
     */
    public static final Long GLOBAL_ID = 1L;
    public static final String GLOBAL_JOIN_CODE = "GLOBAL";
    public static final String GLOBAL_NAME = "Porra Global";

    /** @return true si el id corresponde a la Porra Global. */
    public static boolean isGlobalId(Long leagueId) {
        return GLOBAL_ID.equals(leagueId);
    }

    /** @return true si esta liga es la Porra Global. */
    public boolean isGlobal() {
        return GLOBAL_JOIN_CODE.equalsIgnoreCase(joinCode);
    }

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

    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    /** Reglas personalizadas de la liga (texto libre definido por el admin). */
    @Column(columnDefinition = "TEXT")
    private String rules;

    /** Momento de la última subida de imagen. Null si la liga no tiene imagen. Sirve para versionar la URL. */
    @Column(name = "image_updated_at")
    private LocalDateTime imageUpdatedAt;

    @Transient
    public String getAdminParticipantName() {
        return adminUser != null ? adminUser.getParticipantName() : null;
    }

    @Transient
    public void setAdminParticipantName(String name) {
        // Valor derivado; el setter se ignora a propósito.
    }

    /** URL pública (versionada) de la imagen de la liga, o null si no tiene. */
    @com.fasterxml.jackson.annotation.JsonProperty("imageUrl")
    @Transient
    public String getImageUrl() {
        if (id == null || imageUpdatedAt == null) return null;
        return "/api/groups/" + id + "/image?v=" + imageUpdatedAt.toInstant(java.time.ZoneOffset.UTC).toEpochMilli();
    }

    @com.fasterxml.jackson.annotation.JsonProperty("adminUserId")
    @Transient
    public Long getAdminUserId() {
        return adminUser != null ? adminUser.getId() : null;
    }
}
