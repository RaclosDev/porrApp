package com.porra.mundial.model;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.io.Serializable;

/** Competición oficial de la que una liga multicompetición toma partidos (también la principal). */
@Entity
@Table(name = "edition_competitions")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class EditionCompetition {

    @EmbeddedId
    private Key id;

    @Embeddable
    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @EqualsAndHashCode
    public static class Key implements Serializable {
        @Column(name = "edition_id")
        private Long editionId;
        @Column(name = "competition_id")
        private Long competitionId;
    }
}
