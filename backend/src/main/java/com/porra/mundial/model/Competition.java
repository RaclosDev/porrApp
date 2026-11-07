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

    /** Identificador de la Fórmula 1 (ESPN {@code racing/f1}); su formato es "RACE". */
    public static final String FORMULA_ONE_EXTERNAL_ID = "f1";

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
        if (ownerLeague != null || externalId == null || WORLD_CUP_EXTERNAL_ID.equals(externalId)) return false;
        return "TOURNAMENT".equals(formatType) || LEAGUES_WITH_KNOCKOUTS.contains(externalId);
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
        return hasOwnBracket() && Sport.ofExternalId(externalId) == Sport.FOOTBALL;
    }
}
