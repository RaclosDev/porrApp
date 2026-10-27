package com.porra.mundial.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.Map;

/**
 * DTO que representa la Puntuación Final calculada de un participante.
 * Se genera dinámicamente y se envía al Frontend para pintar la tabla de clasificación.
 * Contiene un desglose detallado de dónde provienen los puntos.
 */
@Data
@Builder
public class ParticipantScoreDTO {
    /** Identificador de la apuesta evaluada. */
    private Long id;
    /** Identificador de la cuenta de usuario propietaria de la apuesta. */
    private Long userId;
    /** Nombre público del participante en el ranking. */
    private String name;
    /** Título/Nombre de su apuesta. */
    private String betName;
    
    /** (Opcional) Predicción del partido de tercer y cuarto puesto. */
    private List<String> thirdPlaceMatch;
    /** (Opcional) Ganador predicho del partido de tercer y cuarto puesto. */
    private String thirdPlaceWinner;
    
    /** Puntos obtenidos por acertar en la Fase de Grupos. */
    private int r1;
    /** Puntos por Dieciseisavos de final. */
    private int r32;
    /** Puntos por Octavos de final. */
    private int r16;
    /** Puntos por Cuartos de final. */
    private int qf;
    /** Puntos por Semifinales. */
    private int sf;
    /** Puntos por la Final (y campeón). */
    private int finals;
    /** Puntos por acertar el Pichichi. */
    private int scorer;
    /** Puntos obtenidos en pronósticos de partidos directos y jornadas (1X2 y marcador). */
    private int matchPoints;
    /** Suma total de puntos acumulados. */
    private int total;
    
    /** Historial de mensajes detallando exactamente por qué se otorgó cada punto (Ej: "+1 por acertar a España en cuartos"). */
    private List<LogEntry> log;
    
    /** Mapa auxiliar indicando con verde exacto equipos que acertó en su posición original del bracket. */
    private Map<String, Object> exactMatches;
    
    /** Mapa auxiliar de equipos que simplemente acertó que pasaban de ronda, sin importar por dónde. */
    private Map<String, Boolean> passedTeams;
    
    /** Indicador visual en UI si la apuesta tiene el pago pendiente. */
    private boolean pending;

    /**
     * Sub-DTO para el registro de auditoría de puntos de cada participante.
     */
    @Data
    @Builder
    public static class LogEntry {
        /** Fase a la que pertenece el punto (ej: "r16", "qf", "matchday"). */
        private String stage;
        /** Cantidad de puntos (ej: 1, 2, 5). */
        private int amount;
        /** Descripción en lenguaje natural del hito alcanzado. */
        private String msg;
    }
}
