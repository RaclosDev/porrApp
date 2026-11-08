package com.porra.mundial.model;

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

    /** Temporada del Mundial que se juega en la app: el rango de fechas que se pide a ESPN. */
    public static final String WORLD_CUP_SEASON = "2026";

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

    /** ID externo de la competición en APIs de terceros (ej. ESPN: "esp.1", "uefa.champions", "fifa.world") */
    @Column(length = 50, unique = true)
    private String externalId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_league_id")
    private League ownerLeague;

    /** Formato de la competición: "LEAGUE" (ligas regulares) o "TOURNAMENT" (torneos con eliminatorias). */
    @Builder.Default
    @Column(name = "format_type", length = 30)
    private String formatType = "LEAGUE";

    @Builder.Default
    private Instant createdAt = Instant.now();

    /**
     * Competiciones con fase de liga (jornadas) seguida de eliminatorias: además de por jornadas, se
     * pueden pronosticar sus eliminatorias.
     */
    static final Set<String> LEAGUES_WITH_KNOCKOUTS = Set.of("uefa.champions", "uefa.europa", "uefa.europa.conf");

    /**
     * Torneo oficial con cuadro propio (Worlds de LoL, Copa del Rey, eliminatorias de la Champions…): se
     * pronostica sobre sus cruces reales, no sobre el cuadro del Mundial.
     */
    public boolean hasOwnBracket() {
        if (ownerLeague != null || externalId == null || isWorldCup()) return false;
        return "TOURNAMENT".equals(formatType) || LEAGUES_WITH_KNOCKOUTS.contains(externalId);
    }

    /** El Mundial: la única competición con grupos, terceros, cuadro y pichichi oficiales. */
    public boolean isWorldCup() {
        return isWorldCup(externalId);
    }

    public static boolean isWorldCup(String externalId) {
        return WORLD_CUP_EXTERNAL_ID.equalsIgnoreCase(externalId);
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
