package app.porrapp.model;

import app.porrapp.dto.OrganizedTournamentDTO.Match;
import app.porrapp.dto.OrganizedTournamentDTO.Participant;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "organized_tournaments")
@Getter @Setter
public class OrganizedTournament {
    @Id private Long id;
    @MapsId @OneToOne(fetch = FetchType.LAZY) @JoinColumn(name = "id") private League league;
    @Column(nullable = false, length = 80) private String activity;
    @Column(nullable = false, length = 20) private String participantType;
    @Column(nullable = false, length = 20) private String format = "MANUAL";
    @Column(nullable = false, unique = true) private UUID publicId = UUID.randomUUID();
    @Column(nullable = false) private boolean published;
    @Column(nullable = false) private long revision;
    @Column(nullable = false) private int winPoints = 3;
    @Column(nullable = false) private int drawPoints = 1;
    @Column(nullable = false) private int lossPoints;
    @JdbcTypeCode(SqlTypes.JSON) @Column(nullable = false, columnDefinition = "jsonb")
    private List<Participant> participants = List.of();
    @JdbcTypeCode(SqlTypes.JSON) @Column(nullable = false, columnDefinition = "jsonb")
    private List<Match> matches = List.of();
}
