package com.porra.mundial.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

/**
 * 📝 Entidad 'Bet' (Apuesta / Porra)
 * Representa la porra que un usuario envía al servidor. 
 * Se guarda en la tabla "bets" de la base de datos.
 */
@Entity
@Table(name = "bets")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Bet {

    // El identificador único de cada porra en la base de datos (Ej: 1, 2, 3...)
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // El nombre de la persona que participa (Ej: "Raclo")
    @Column(nullable = false)
    private String participantName;

    // Un apodo o nombre para la porra (por si alguien hace más de una)
    private String betName;

    // Aquí guardamos tooooda la predicción comprimida en un formato llamado Base64.
    // Así no tenemos que crear 64 columnas en la base de datos para cada partido.
    @Column(columnDefinition = "TEXT")
    private String hash; 

    // ¿Ha pagado ya la entrada de la porra? (Por defecto es falso)
    @Builder.Default
    private Boolean paid = false;

    // La fecha y hora exacta en la que se guardó la porra en el servidor
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
