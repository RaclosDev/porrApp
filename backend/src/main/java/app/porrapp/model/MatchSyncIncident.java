package app.porrapp.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

/**
 * Cambio de resultado que la sincronización no ha aplicado solo y queda para que lo revise el administrador
 * de porrApp. Guarda lo que había y lo último que ha mandado el proveedor.
 */
@Entity
@Table(name = "match_sync_incidents")
@Getter @Setter
public class MatchSyncIncident {

    /** Qué ha pasado. */
    public enum Kind {
        /** Un partido terminado vuelve sin acabar o sin marcador: se bloquea siempre. */
        REGRESSION,
        /** Un partido terminado llega con otro marcador final: se aplica si se confirma. */
        SCORE_CHANGE,
        /** Una pelea ya no está en la cartelera: se cancela si se confirma. */
        FIGHT_MISSING
    }

    /** En qué punto está. */
    public enum Status {
        /** Retenido: solo lo aplica el administrador. */
        BLOCKED,
        /** Retenido a la espera de que el proveedor lo confirme. */
        PENDING,
        APPLIED,
        DISMISSED;

        public boolean isOpen() {
            return this == BLOCKED || this == PENDING;
        }
    }

    public static final String BY_AUTO = "auto";
    public static final String BY_ADMIN = "admin";

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(nullable = false) private Long matchId;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) private Kind kind;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) private Status status;

    @Enumerated(EnumType.STRING) @Column(length = 30) private MatchStatusNormalized previousStatus;
    private Integer previousHomeScore;
    private Integer previousAwayScore;
    private Long previousWinnerTeamId;

    @Enumerated(EnumType.STRING) @Column(length = 30) private MatchStatusNormalized receivedStatus;
    private Integer receivedHomeScore;
    private Integer receivedAwayScore;
    private Long receivedWinnerTeamId;

    @Column(nullable = false) private Instant firstSeenAt;
    @Column(nullable = false) private Instant lastSeenAt;
    @Column(nullable = false) private int seenCount = 1;
    private Instant resolvedAt;
    @Column(length = 20) private String resolvedBy;

    public boolean isOpen() {
        return status != null && status.isOpen();
    }
}
