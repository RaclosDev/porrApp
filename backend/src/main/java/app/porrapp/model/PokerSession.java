package app.porrapp.model;

import app.porrapp.dto.PokerDTO.BlindClock;
import app.porrapp.dto.PokerDTO.Entry;
import app.porrapp.dto.PokerDTO.Settings;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDate;
import java.util.List;

@Entity
@Table(name = "poker_sessions")
@Getter
@Setter
public class PokerSession {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long leagueId;

    @Column(nullable = false)
    private LocalDate scheduledOn;

    private Long startedAt;
    private Long closedAt;

    @Column(nullable = false)
    private long revision;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private Settings settings;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private List<Entry> entries = List.of();

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private List<Long> eliminations = List.of();

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private BlindClock blindClock;
}
