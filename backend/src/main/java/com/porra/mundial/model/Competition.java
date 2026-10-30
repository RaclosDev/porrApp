package com.porra.mundial.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

/** Torneo o liga deportiva. Ejemplos: "LaLiga EA Sports", "UEFA Champions League", "Mundial 2026". */
@Entity
@Table(name = "competitions")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Competition {

    /** Identificador del Mundial 2026 en ESPN. */
    public static final String WORLD_CUP_EXTERNAL_ID = "fifa.world";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Nombre de la competición. Ej: "LaLiga EA Sports", "UEFA Champions League" */
    @Column(nullable = false, length = 100)
    private String name;

    /** ID externo de la competición en APIs de terceros (ej. ESPN: "esp.1", "uefa.champions", "fifa.world") */
    @Column(length = 50, unique = true)
    private String externalId;

    /** Formato de la competición: "LEAGUE" (ligas regulares) o "TOURNAMENT" (torneos con eliminatorias). */
    @Builder.Default
    @Column(name = "format_type", length = 30)
    private String formatType = "LEAGUE";

    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
