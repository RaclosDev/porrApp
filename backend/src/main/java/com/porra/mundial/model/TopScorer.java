package com.porra.mundial.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Goleador guardado de una competición, en el puesto que ocupa en su lista. */
@Entity
@Table(name = "top_scorers")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class TopScorer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "competition_id", nullable = false)
    private Long competitionId;

    /** Puesto en la lista, desde 0: conserva el orden en los empates a goles. */
    @Column(nullable = false)
    private int position;

    @Column(nullable = false)
    private String name;

    @Column(name = "short_name", nullable = false)
    private String shortName;

    @Column(nullable = false)
    private int goals;

    @Column(name = "player_position", nullable = false)
    private String playerPosition;

    @Column(name = "player_id", nullable = false)
    private String playerId;

    @Column(nullable = false)
    private String team;

    @Column(name = "image_url", nullable = false, length = 2048)
    private String imageUrl;
}
