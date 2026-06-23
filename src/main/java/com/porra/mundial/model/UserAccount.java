package com.porra.mundial.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * 👤 Entidad 'UserAccount'
 * Guarda la relación entre una cuenta de Google (email) y el nombre de participante en la porra.
 * Esto evita suplantaciones de identidad.
 */
@Entity
@Table(name = "app_users")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class UserAccount {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // El email de Google de la persona (Ej: raclo@gmail.com)
    @Column(nullable = false, unique = true)
    private String googleEmail;

    // El nombre real que tiene en Google (para tenerlo de referencia)
    private String googleName;

    // El apodo o nombre con el que se identifica en la porra (Ej: "Raclos")
    @Column(nullable = false)
    private String participantName;

    @Builder.Default
    private boolean isSuperadmin = false;

    @Builder.Default
    private LocalDateTime linkedAt = LocalDateTime.now();

    @Column(name = "last_selected_group_id")
    private Long lastSelectedGroupId;
}
