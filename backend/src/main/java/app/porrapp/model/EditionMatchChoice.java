package app.porrapp.model;

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

/** Partido añadido ({@code included}) o quitado a mano de una liga. */
@Entity
@Table(name = "edition_match_choices")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class EditionMatchChoice {

    @EmbeddedId
    private Key id;

    @Column(nullable = false)
    private boolean included;

    @Embeddable
    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @EqualsAndHashCode
    public static class Key implements Serializable {
        @Column(name = "edition_id")
        private Long editionId;
        @Column(name = "match_id")
        private Long matchId;
    }
}
