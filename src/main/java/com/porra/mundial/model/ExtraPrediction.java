package com.porra.mundial.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Entity
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "pronosticos_extra")
public class ExtraPrediction {

    @Id
    @Column(name = "bet_id")
    private Long id; // Maps to bet_id

    @OneToOne(fetch = FetchType.LAZY)
    @MapsId
    @JoinColumn(name = "bet_id")
    private Bet bet;

    @Column(name = "top_scorer", length = 255)
    private String topScorer;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "champion_team_id", nullable = false)
    private Team championTeam;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "third_place_team_id")
    private Team thirdPlaceTeam;
}
