package app.porrapp.model;

import app.porrapp.dto.OrganizedTournamentDTO.Match;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.Instant;

@Entity @Table(name = "tournament_result_changes") @Getter @Setter
public class TournamentResultChange {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(nullable = false) private Long tournamentId;
    @Column(nullable = false) private long revision;
    @Column(nullable = false) private Instant changedAt = Instant.now();
    private Long actorId;
    @JdbcTypeCode(SqlTypes.JSON) @Column(nullable = false, columnDefinition = "jsonb") private Match beforeResult;
    @JdbcTypeCode(SqlTypes.JSON) @Column(nullable = false, columnDefinition = "jsonb") private Match afterResult;
}
