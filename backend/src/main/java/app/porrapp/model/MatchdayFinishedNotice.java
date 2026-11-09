package app.porrapp.model;

import jakarta.persistence.*;
import lombok.*;

import java.io.Serializable;
import java.time.Instant;

/** Jornada de una edición cuyo final ya se avisó a los miembros de la liga. */
@Entity
@Table(name = "matchday_finished_notices")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class MatchdayFinishedNotice {

    @EmbeddedId
    private Key id;

    @Column(name = "sent_at", nullable = false)
    private Instant sentAt;

    @Embeddable
    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @EqualsAndHashCode
    public static class Key implements Serializable {
        @Column(name = "edition_id")
        private Long editionId;
        @Column(name = "matchday")
        private String matchday;
    }
}
