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

/** Equipo seguido por una liga: sus partidos, también los que lleguen más tarde, entran en ella. */
@Entity
@Table(name = "edition_followed_teams")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class EditionFollowedTeam {

    @EmbeddedId
    private Key id;

    @Embeddable
    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @EqualsAndHashCode
    public static class Key implements Serializable {
        @Column(name = "edition_id")
        private Long editionId;
        @Column(name = "team_id")
        private Long teamId;
    }
}
