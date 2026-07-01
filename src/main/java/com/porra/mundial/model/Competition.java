package com.porra.mundial.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

/**
 * 🏆 Entidad 'Competition' (Competición).
 * Representa un torneo global gestionado por la aplicación.
 * Ejemplos: "Mundial 2026", "Eurocopa 2024".
 */
@Entity
@Table(name = "competitions")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Competition {

    /** Identificador autogenerado. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Nombre de la competición. Ej: "Euro 2024" */
    @Column(nullable = false, length = 100)
    private String name;

    /** ID externo de la competición en APIs de terceros (ej. ESPN: "uefa.euro") */
    @Column(length = 50, unique = true)
    private String externalId;

    /** Fecha en la que se dio de alta la competición. */
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
