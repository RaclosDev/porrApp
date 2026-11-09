package app.porrapp.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/** Piloto de Fórmula 1 tal como lo da ESPN; la escudería y el dorsal son los de su última carrera. */
@Entity
@Table(name = "race_drivers")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class RaceDriver {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Id del piloto en ESPN. */
    @Column(name = "external_id", nullable = false, unique = true, length = 30)
    private String externalId;

    @Column(nullable = false, length = 100)
    private String name;

    /** Nombre corto: "L. Norris". */
    @Column(name = "short_name", length = 60)
    private String shortName;

    @Column(length = 60)
    private String country;

    @Column(name = "flag_url", length = 500)
    private String flagUrl;

    @Column(name = "team_name", length = 100)
    private String teamName;

    /** Color de la escudería en hexadecimal, sin almohadilla. */
    @Column(name = "team_color", length = 6)
    private String teamColor;

    @Column(name = "car_number", length = 4)
    private String carNumber;

    @Builder.Default
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();
}
