package com.porra.mundial.model;

import jakarta.persistence.*;
import lombok.*;

/**
 * Datos de pelea de un partido de MMA (UFC): su velada, su bloque de la cartelera y cómo acabó. El
 * partido guarda los luchadores (como equipos), la fecha del bloque, el estado y el ganador.
 */
@Entity
@Table(name = "fights")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Fight {

    /** Bloques de la cartelera. */
    public static final String MAIN_CARD = "MAIN";
    public static final String PRELIMS = "PRELIMS";
    public static final String EARLY_PRELIMS = "EARLY_PRELIMS";

    @Id
    @Column(name = "match_id")
    private Long matchId;

    /** Id de la velada en ESPN. */
    @Column(name = "event_external_id", nullable = false, length = 50)
    private String eventExternalId;

    /** Bloque: {@link #MAIN_CARD}, {@link #PRELIMS} o {@link #EARLY_PRELIMS}. */
    @Column(name = "card_segment", length = 20)
    private String cardSegment;

    /** Orden en la cartelera: 1 es la pelea estelar. */
    @Column(name = "bout_order")
    private Integer boutOrder;

    @Column(name = "weight_class", length = 60)
    private String weightClass;

    /** Título en juego tal como lo da ESPN («UFC Heavyweight Title»); null si no hay título. */
    @Column(name = "title", length = 60)
    private String title;

    /** Asaltos previstos (3 o 5). */
    @Column(name = "scheduled_rounds")
    private Integer scheduledRounds;

    @Column(name = "home_record", length = 20)
    private String homeRecord;

    @Column(name = "away_record", length = 20)
    private String awayRecord;

    @Enumerated(EnumType.STRING)
    @Column(name = "result_method", length = 20)
    private FightMethod resultMethod;

    /** Detalle del método tal como lo da ESPN («Decision - Split», «Rear Naked Choke»…). */
    @Column(name = "result_detail", length = 100)
    private String resultDetail;

    /** Asalto en que acabó. */
    @Column(name = "result_round")
    private Integer resultRound;

    /** Tiempo del asalto en que acabó («1:28»). */
    @Column(name = "result_clock", length = 10)
    private String resultClock;

    /** Tarjetas de los jueces de una decisión, separadas por «|» («30-27 | 29-28 | 30-27»). */
    @Column(name = "judges_scores", length = 40)
    private String judgesScores;
}
