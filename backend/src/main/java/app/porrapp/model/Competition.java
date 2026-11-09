package app.porrapp.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.Set;

/** Torneo o liga deportiva. Ejemplos: "LaLiga EA Sports", "UEFA Champions League", "Mundial 2026". */
@Entity
@Table(name = "competitions")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Competition {

    /** Identificador del Mundial 2026 en ESPN. */
    public static final String WORLD_CUP_EXTERNAL_ID = "fifa.world";

    /**
     * Formato de las competiciones por veladas (la UFC): cada velada es una jornada con su nombre, sin
     * numeración de jornadas ni cuadro.
     */
    public static final String EVENTS_FORMAT = "EVENTS";

    /** Identificador de la Fórmula 1 (ESPN {@code racing/f1}); su formato es "RACE". */
    public static final String FORMULA_ONE_EXTERNAL_ID = "f1";

    /** Identificador de la NBA (ESPN {@code basketball/nba}): solo sus playoffs, serie a serie. */
    public static final String NBA_EXTERNAL_ID = "nba";

    /**
     * Temporada regular de la NBA (ESPN {@code basketball/nba}, tipo 2): partido a partido, por semanas
     * oficiales de la NBA, con la Copa NBA dentro. Va aparte de los playoffs, que se juegan serie a serie.
     */
    public static final String NBA_REGULAR_SEASON_EXTERNAL_ID = "nba.regular";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Nombre de la competición. Ej: "LaLiga EA Sports", "UEFA Champions League" */
    @Column(nullable = false, length = 100)
    private String name;

    /**
     * ID externo de la competición en APIs de terceros (ej. ESPN: "esp.1", "uefa.champions", "fifa.world").
     * Cada temporada es una fila: lo comparten la vigente y las archivadas, y solo es único entre las vigentes.
     */
    @Column(length = 50)
    private String externalId;

    /** Temporada de esta fila tal como la da el proveedor ("2026/27", "2026"); null si aún no se sabe. */
    @Column(length = 20)
    private String season;

    /** Cuándo dejó de ser la temporada vigente; null en la vigente y en las competiciones personalizadas. */
    private Instant archivedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_league_id")
    private League ownerLeague;

    /** Formato de la competición: "LEAGUE" (ligas regulares) o "TOURNAMENT" (torneos con eliminatorias). */
    @Builder.Default
    @Column(name = "format_type", length = 30)
    private String formatType = "LEAGUE";

    /**
     * Deporte elegido al crear una competición personalizada. Null en las oficiales, cuyo deporte sale
     * de su id externo, y en las personalizadas de otro deporte.
     */
    @Enumerated(EnumType.STRING)
    @Column(length = 30)
    private Sport sport;

    @Builder.Default
    private Instant createdAt = Instant.now();

    /** Temporada pasada: ya no se sincroniza, no sale en el catálogo ni admite ligas nuevas. */
    public boolean isArchived() {
        return archivedAt != null;
    }

    /** Año en que empieza su temporada ("2026/27" → 2026); null si no está anotada o no se entiende. */
    public Integer seasonStartYear() {
        if (season == null || !season.matches("[0-9]{4}(/[0-9]{2})?")) return null;
        return Integer.valueOf(season.substring(0, 4));
    }

    /** Deporte de la competición: el guardado en las personalizadas, el de su id externo en las oficiales. */
    public Sport sport() {
        return ownerLeague != null && sport != null ? sport : Sport.ofExternalId(externalId);
    }

    /**
     * Deporte cuyas reglas de predicción sigue. Una competición personalizada no tiene las series, los
     * sets ni las veladas del proveedor: de su deporte solo cuenta si un partido puede acabar en empate,
     * así que se juega como el fútbol (1X2) o como el baloncesto (quién gana).
     */
    public Sport rulesSport() {
        if (ownerLeague == null) return Sport.ofExternalId(externalId);
        return sport().allowsDraws() ? Sport.FOOTBALL : Sport.BASKETBALL;
    }

    /**
     * Competiciones con fase de liga (jornadas) seguida de eliminatorias: además de por jornadas, se
     * pueden pronosticar sus eliminatorias.
     */
    static final Set<String> LEAGUES_WITH_KNOCKOUTS = Set.of("uefa.champions", "uefa.europa", "uefa.europa.conf");

    /**
     * Torneo oficial con cuadro propio (Worlds de LoL, Copa del Rey, eliminatorias de la Champions…): se
     * pronostica sobre sus cruces reales, no sobre un cuadro que sale de la fase de grupos.
     */
    public boolean hasOwnBracket() {
        if (ownerLeague != null || externalId == null || isGroupTournament()) return false;
        return "TOURNAMENT".equals(formatType) || LEAGUES_WITH_KNOCKOUTS.contains(externalId);
    }

    /**
     * Torneo con fase de grupos y eliminatorias que se predice entero antes de empezar (el Mundial, la Eurocopa):
     * grupos, terceros, cuadro y máximo goleador oficiales, con la forma que dice su {@link TournamentFormat}.
     */
    public boolean isGroupTournament() {
        return tournamentFormat() != null;
    }

    /** Formato del torneo con grupos, o {@code null} si la competición no lo es. */
    public TournamentFormat tournamentFormat() {
        return TournamentFormat.registered(this);
    }

    /** Fórmula 1: se sincroniza y se predice Gran Premio a Gran Premio, no partido a partido. */
    public boolean isFormulaOne() {
        return ownerLeague == null && FORMULA_ONE_EXTERNAL_ID.equals(externalId);
    }

    public static boolean isFormulaOne(Competition competition) {
        return competition != null && competition.isFormulaOne();
    }

    /**
     * En fútbol los cruces de cada ronda se sortean al acabar la anterior (y a veces a doble partido): no
     * hay un cuadro fijo que rellenar de una vez, así que se pronostica quién pasa ronda a ronda.
     */
    public boolean drawsKnockoutRounds() {
        Sport sport = Sport.ofExternalId(externalId);
        return hasOwnBracket() && (sport == Sport.FOOTBALL || playsSeries());
    }

    /**
     * Playoffs de la NBA: cada cruce es una serie al mejor de 7 (el play-in, a partido único) y se
     * pronostica quién la gana y en cuántos partidos. Solo se juega en «Solo eliminatorias».
     */
    public boolean playsSeries() {
        return ownerLeague == null && NBA_EXTERNAL_ID.equals(externalId);
    }
}
