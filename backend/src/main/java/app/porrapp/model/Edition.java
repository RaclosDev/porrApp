package app.porrapp.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;

/** Une una liga con una competición; una liga puede tener varias ediciones. */
@Entity
@Table(name = "editions")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Edition {

    private static final ZoneId TOURNAMENT_ZONE = ZoneId.of("Europe/Madrid");
    /**
     * Solo el cuadro de un torneo con grupos tiene una fecha de cierre conocida, la de su formato; el
     * resto se cierra como diga su liga.
     */
    public static Instant defaultLockDate(Competition competition, PoolFormat format) {
        return isGroupTournamentBracket(competition, format) ? competition.tournamentFormat().bracketDeadline() : null;
    }

    /**
     * Cuadro de un torneo con fase de grupos (completo o solo eliminatorias): grupos, terceros y cruces
     * oficiales, con la forma del torneo.
     */
    public static boolean isGroupTournamentBracket(Competition competition, PoolFormat format) {
        return competition != null && competition.isGroupTournament()
                && (format == PoolFormat.FULL_BRACKET || format == PoolFormat.KNOCKOUTS_ONLY);
    }

    /** @see #isGroupTournamentBracket(Competition, PoolFormat) */
    public boolean isGroupTournamentBracket() {
        return isGroupTournamentBracket(competition, poolFormat);
    }

    /** Puntúa el máximo goleador: solo en el cuadro de un torneo con grupos, que tiene goleadores oficiales. */
    public boolean scoresPichichi() {
        return pichichi && isGroupTournamentBracket();
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "league_id", nullable = false)
    private League league;

    /** La competición física que se está jugando (Eurocopa, Mundial). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "competition_id", nullable = false)
    private Competition competition;

    /** El formato de la porra o reglas con las que juega este grupo esta edicion. */
    @Enumerated(EnumType.STRING)
    @Column(name = "pool_format", nullable = false, length = 50)
    private PoolFormat poolFormat;

    /** Estado actual de la edición (ej. ACTIVE, ARCHIVED). */
    @Column(nullable = false, length = 20)
    @Builder.Default
    private String status = "ACTIVE";

    /** Fecha en la que el grupo creó esta edición. */
    @Builder.Default
    private Instant createdAt = Instant.now();

    /** Flag indicando si en esta edición se otorgan puntos extra por adivinar al Pichichi. */
    @Builder.Default
    @Column(nullable = false)
    private boolean pichichi = false;

    /** Fecha y hora límite para enviar o editar pronósticos. */
    @Column(name = "lock_date")
    private Instant lockDate;

    /** Cómo se cierran los pronósticos; las competiciones oficiales usan siempre una fecha fija. */
    @Enumerated(EnumType.STRING)
    @Column(name = "lock_mode", nullable = false, length = 20)
    @Builder.Default
    private PredictionLockMode lockMode = PredictionLockMode.FIXED_DATE;

    /** Minutos antes del partido en que se cierra, en los modos que dependen de los partidos. */
    @Column(name = "lock_offset_minutes", nullable = false)
    @Builder.Default
    private int lockOffsetMinutes = 0;

    /** Qué partidos de la competición entran en la liga (solo en ligas por jornadas). */
    @Enumerated(EnumType.STRING)
    @Column(name = "match_selection", nullable = false, length = 20)
    @Builder.Default
    private MatchSelectionMode matchSelection = MatchSelectionMode.ALL;

    /** UFC con todas las veladas: solo las numeradas o solo las Fight Night; null para todas. */
    @Enumerated(EnumType.STRING)
    @Column(name = "event_series", length = 20)
    private EventSeries eventSeries;

    /** UFC: partes de la cartelera de cada velada que entran en la liga; null para la velada completa. */
    @Convert(converter = CardSegmentsConverter.class)
    @Column(name = "card_segments", length = 40)
    private java.util.Set<CardSegment> cardSegments;

    /**
     * Tenis: torneos que sigue una liga de varios (todos, Grand Slams o Masters 1000), cuyos cuadros guarda
     * {@code edition_competitions}; null en una liga de un solo torneo y en el resto de deportes.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "tennis_scope", length = 20)
    private TennisScope tennisScope;

    /** Tenis con {@link #tennisScope}: cuadros que sigue (ATP, WTA o los dos). */
    @Enumerated(EnumType.STRING)
    @Column(name = "tennis_tour", length = 10)
    private TennisTour tennisTour;

    /**
     * Si la liga junta partidos de varias competiciones oficiales (las guarda {@code edition_competitions};
     * {@link #competition} es la principal). Sus jornadas son semanas de lunes a domingo.
     */
    @Column(name = "multi_competition", nullable = false)
    @Builder.Default
    private boolean multiCompetition = false;

    /** Configuración serializada de reglas de puntuación para esta edición. */
    @Column(name = "scoring_rules_json", columnDefinition = "TEXT")
    private String scoringRulesJson;

    /**
     * Comprueba si la edición/porra se encuentra bloqueada para nuevos envíos o cambios.
     */
    public boolean isLocked() {
        return isLocked(Clock.system(TOURNAMENT_ZONE));
    }

    public boolean isLocked(Clock clock) {
        if (!"ACTIVE".equalsIgnoreCase(status)) {
            return true;
        }
        return lockDate != null && !clock.instant().isBefore(lockDate);
    }

}
