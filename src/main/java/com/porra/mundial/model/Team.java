package com.porra.mundial.model;

import jakarta.persistence.*;
import lombok.*;

/**
 * 🛡️ Entidad 'Team' (Equipo)
 * Representa a cada una de las 48 selecciones nacionales que juegan el Mundial.
 */
@Entity
@Table(name = "teams")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Team {

    // Identificador único numérico
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Nombre en español (Ej: "España", "Estados Unidos")
    @Column(nullable = false, unique = true)
    private String name; 

    // Nombre en inglés (sirve para buscar banderas o conectarse a APIs extranjeras)
    private String nameEn; 

    // El ID que usa la web oficial de la FIFA/Mundial
    private String externalId;

    // Letra del grupo en el que juegan ("A" hasta la "L")
    @Column(name = "group_name", length = 2)
    private String groupName;

    // Probabilidad de ganar el partido (cuota de apuestas para la lógica del simulador)
    private Double winOdds;
    
    // Probabilidad de clasificarse a la siguiente ronda
    private Double qualifyOdds;
    
    // Probabilidad absoluta de ganar el Mundial (quedar primeros)
    private Double outrightOdds;

    // Puntos extra ocultos que el administrador puede sumar a mano para forzar un desempate
    @Column(columnDefinition = "integer default 0")
    @Builder.Default
    private Integer manualTieBreaker = 0;
}
