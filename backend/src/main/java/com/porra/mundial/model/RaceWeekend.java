package com.porra.mundial.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Objects;

/**
 * Gran Premio de Fórmula 1. Su fila de {@link Match} lleva el nombre (ronda), la hora de la
 * clasificación (cuando se cierra la predicción) y el estado de la carrera; aquí van la carrera, el
 * circuito y los resultados que se puntúan.
 */
@Entity
@Table(name = "race_weekends")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class RaceWeekend {

    @Id
    @Column(name = "match_id")
    private Long matchId;

    @Column(name = "race_at")
    private Instant raceAt;

    @Column(length = 150)
    private String circuit;

    @Column(length = 100)
    private String city;

    @Column(length = 100)
    private String country;

    /** Fin de semana con carrera al sprint. */
    @Builder.Default
    @Column(nullable = false)
    private boolean sprint = false;

    /** Ids de los pilotos inscritos separados por comas; null hasta que ESPN publica la lista. */
    @Column(name = "entry_list", length = 500)
    private String entryList;

    @Column(name = "pole_driver_id")
    private Long poleDriverId;
    @Column(name = "first_driver_id")
    private Long firstDriverId;
    @Column(name = "second_driver_id")
    private Long secondDriverId;
    @Column(name = "third_driver_id")
    private Long thirdDriverId;
    @Column(name = "fastest_lap_driver_id")
    private Long fastestLapDriverId;

    /** Cuándo se guardaron los resultados de la carrera (podio); null mientras no hay. */
    @Column(name = "results_at")
    private Instant resultsAt;

    /** Cuándo se avisó del resultado; el aviso sale una sola vez por Gran Premio. */
    @Column(name = "results_notified_at")
    private Instant resultsNotifiedAt;

    public boolean hasPodium() {
        return firstDriverId != null && secondDriverId != null && thirdDriverId != null;
    }

    public List<Long> entryDriverIds() {
        if (entryList == null || entryList.isBlank()) return List.of();
        return Arrays.stream(entryList.split(","))
                .map(String::trim)
                .filter(id -> id.matches("\\d{1,18}"))
                .map(Long::valueOf)
                .distinct()
                .toList();
    }

    public static String entryList(List<Long> driverIds) {
        if (driverIds == null || driverIds.isEmpty()) return null;
        String joined = String.join(",", driverIds.stream().filter(Objects::nonNull).distinct().map(String::valueOf).toList());
        return joined.length() > 500 ? joined.substring(0, joined.lastIndexOf(',', 500)) : joined;
    }
}
