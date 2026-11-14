package app.porrapp.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Canción pedida para el modo TV de una liga de póker; la de menor id es la que suena. */
@Entity
@Table(name = "poker_music_queue")
@Getter
@Setter
@NoArgsConstructor
public class PokerMusicItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long leagueId;

    @Column(nullable = false, length = 11)
    private String videoId;

    @Column(nullable = false, length = 150)
    private String title;

    @Column(nullable = false, length = 100)
    private String channel;

    @Column(nullable = false)
    private Long addedBy;

    @Column(nullable = false, length = 60)
    private String addedByName;

    @Column(nullable = false)
    private long createdAt;
}
