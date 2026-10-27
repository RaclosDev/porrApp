package com.porra.mundial.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Imagen (logo) de una liga. Se guarda aparte de {@link League} para no cargar los bytes
 * cada vez que se lee una liga. Solo existe una fila por liga.
 */
@Entity
@Table(name = "league_images")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class LeagueImage {

    @Id
    @Column(name = "league_id")
    private Long leagueId;

    @Column(name = "content_type", nullable = false, length = 50)
    private String contentType;

    @Column(name = "data", nullable = false)
    private byte[] data;

    @Column(name = "size_bytes", nullable = false)
    private int sizeBytes;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
