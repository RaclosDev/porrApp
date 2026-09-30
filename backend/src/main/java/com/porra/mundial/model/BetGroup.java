package com.porra.mundial.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

/**
 * 👥 Entidad 'BetGroup' (Grupo o Liga Privada).
 * Representa un grupo privado de amigos o compañeros de trabajo.
 * Cada grupo tiene un administrador y un código único para invitar a otros.
 * Se almacena en la tabla "leagues".
 */
@Entity
@Table(name = "leagues")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class BetGroup {

    /** Identificador autogenerado del grupo. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Nombre visible del grupo. Ej: "Informática Euro 24". */
    @Column(nullable = false)
    private String name;

    /** Código alfanumérico único para unirse al grupo. */
    @Column(nullable = false, unique = true, length = 10)
    private String joinCode;

    /** Usuario que creó el grupo y que tiene permisos para borrar miembros o validar pagos. */
    @com.fasterxml.jackson.annotation.JsonIgnore
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "admin_user_id", nullable = false)
    private UserAccount adminUser;

    /** Fecha de creación. */
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    @Transient
    public String getAdminParticipantName() {
        return adminUser != null ? adminUser.getParticipantName() : null;
    }

    @Transient
    public void setAdminParticipantName(String name) {
        // Ignored by JPA, needed for builders temporarily
    }

    @com.fasterxml.jackson.annotation.JsonProperty("adminUserId")
    @Transient
    public Long getAdminUserId() {
        return adminUser != null ? adminUser.getId() : null;
    }
}
