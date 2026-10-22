package com.porra.mundial.model;

import jakarta.persistence.*;
import lombok.*;

/**
 * ️ Entidad 'Team' (Equipo).
 * Representa a cada una de las selecciones nacionales que juegan el Torneo.
 */
@Entity
@Table(name = "teams")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Team {

    /** Identificador único numérico de la base de datos local. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Nombre en español (Ej: "España", "Estados Unidos"). */
    @Column(nullable = false, unique = true)
    private String name; 

    /** Nombre en inglés (sirve para buscar iconos de banderas estáticos). */
    private String nameEn; 

    /** El ID que usa la web oficial de la competición (API de ESPN). */
    private String externalId;

    /** Letra del grupo en el que juegan en la primera fase ("A" hasta la "L"). */
    @Column(name = "group_name", length = 2)
    private String groupName;

    /** Probabilidad de ganar el partido (cuota de apuestas para la lógica del simulador). */
    private Double winOdds;
    
    /** Probabilidad de clasificarse a la siguiente ronda. */
    private Double qualifyOdds;
    
    /** Probabilidad absoluta de ganar el Torneo (quedar primeros). */
    private Double outrightOdds;

}
