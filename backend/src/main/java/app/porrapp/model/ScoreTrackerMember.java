package app.porrapp.model;

import jakarta.persistence.*;
import lombok.*;

import java.io.Serializable;
import java.time.Instant;

/** Usuario que ve un marcador en directo (entró con su código). */
@Entity
@Table(name = "score_tracker_members")
@IdClass(ScoreTrackerMember.Key.class)
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ScoreTrackerMember {

    @Id
    @Column(name = "tracker_id")
    private Long trackerId;

    @Id
    @Column(name = "user_id")
    private Long userId;

    @Builder.Default
    @Column(name = "joined_at", nullable = false)
    private Instant joinedAt = Instant.now();

    @EqualsAndHashCode
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Key implements Serializable {
        private Long trackerId;
        private Long userId;
    }
}
