package com.porra.mundial.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.Map;

/** Puntos de una porra por fase, con su desglose. */
@Data
@Builder
public class ParticipantScoreDTO {
    private Long id;
    private Long userId;
    private String name;
    private String predictionName;
    /** URL versionada de la foto de perfil del participante, o null si no tiene. */
    private String avatarUrl;
    
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
    private int total;
    
    /** Historial de mensajes detallando exactamente por qué se otorgó cada punto (Ej: "+1 por acertar a España en cuartos"). */
    private List<LogEntry> log;
    
    /** Posiciones de grupo acertadas exactamente. */
    private Map<String, Object> exactMatches;
    
    /** Mapa auxiliar de equipos que simplemente acertó que pasaban de ronda, sin importar por dónde. */
    private Map<String, Boolean> passedTeams;
    
    /** Pago pendiente: no cuenta en la clasificación. */
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
