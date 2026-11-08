package com.porra.mundial.model;

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
    // Fecha de cierre de cuadros ya establecida por V24, también para las nuevas ligas.
    private static final Instant WORLD_CUP_DEADLINE = Instant.parse("2026-06-11T18:00:00Z"); // 20:00 en Madrid

    /** Solo el cuadro del Mundial tiene una fecha de cierre conocida; el resto se cierra como diga su liga. */
    public static Instant defaultLockDate(Competition competition, PoolFormat format) {
        return isWorldCupBracket(competition, format) ? WORLD_CUP_DEADLINE : null;
    }

    /** Cuadro del Mundial (completo o solo eliminatorias): grupos, terceros y cruces oficiales de la FIFA. */
    public static boolean isWorldCupBracket(Competition competition, PoolFormat format) {
        return competition != null && competition.isWorldCup()
                && (format == PoolFormat.FULL_BRACKET || format == PoolFormat.KNOCKOUTS_ONLY);
    }

    /** @see #isWorldCupBracket(Competition, PoolFormat) */
    public boolean isWorldCupBracket() {
        return isWorldCupBracket(competition, poolFormat);
    }

    /** Puntúa el máximo goleador: solo en el cuadro del Mundial, el único con pichichi oficial. */
    public boolean scoresPichichi() {
        return pichichi && isWorldCupBracket();
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
