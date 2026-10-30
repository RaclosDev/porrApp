package com.porra.mundial.model;

import jakarta.persistence.*;
import lombok.*;

/** Equipo de una competición: selección o club. */
@Entity
@Table(name = "teams")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Team {

    /** Equipo comodín para los huecos del calendario que aún no tienen rival definido. */
    public static final String PLACEHOLDER_NAME = "Por definir";
    public static final String PLACEHOLDER_NAME_EN = "TBD";

    /** @return true si el equipo no existe o es el comodín "Por definir". */
    public static boolean isPlaceholder(Team team) {
        return team == null
                || PLACEHOLDER_NAME.equalsIgnoreCase(team.getName())
                || PLACEHOLDER_NAME_EN.equalsIgnoreCase(team.getName())
                || PLACEHOLDER_NAME_EN.equalsIgnoreCase(team.getNameEn());
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Nombre del equipo (Ej: "Real Madrid", "Barcelona", "España"). */
    @Column(nullable = false, unique = true)
    private String name; 

    /** Nombre en inglés (sirve para búsquedas o iconos estáticos). */
    private String nameEn; 

    /** El ID que usa la web oficial de la competición (API de ESPN). */
    private String externalId;

    /** URL del escudo oficial en alta resolución (proporcionado por ESPN). */
    @Column(name = "logo_url", length = 500)
    private String logoUrl;

    /** Letra del grupo en el que juegan si aplica ("A" hasta la "L"), o "-" en ligas regulares. */
    @Column(name = "group_name", length = 2)
    private String groupName;

    /** Probabilidad de ganar el partido (cuota para lógica del simulador). */
    private Double winOdds;
    
    /** Probabilidad de clasificarse a la siguiente ronda. */
    private Double qualifyOdds;
    
    /** Probabilidad absoluta de ganar el Torneo (quedar primeros). */
    private Double outrightOdds;
}
