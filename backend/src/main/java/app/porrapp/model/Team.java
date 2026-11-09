package app.porrapp.model;

import jakarta.persistence.*;
import lombok.*;

/**
 * Equipo: selección, club o deportista. El grupo en el que juega un torneo no es suyo, sino de su
 * participación en ese torneo ({@link CompetitionTeam}).
 */
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
    @Column(nullable = false)
    private String name; 

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "competition_id")
    private Competition competition;

    /** Nombre en inglés (sirve para búsquedas o iconos estáticos). */
    private String nameEn; 

    /** El ID que usa la web oficial de la competición (API de ESPN). */
    private String externalId;

    /** URL del escudo oficial en alta resolución (proporcionado por ESPN). */
    @Column(name = "logo_url", length = 500)
    private String logoUrl;

    /** Probabilidad de ganar el partido (cuota para lógica del simulador). */
    private Double winOdds;
    
    /** Probabilidad de clasificarse a la siguiente ronda. */
    private Double qualifyOdds;
    
    /** Probabilidad absoluta de ganar el Torneo (quedar primeros). */
    private Double outrightOdds;
}
