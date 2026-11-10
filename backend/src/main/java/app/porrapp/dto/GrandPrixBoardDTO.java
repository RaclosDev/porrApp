package app.porrapp.dto;

import java.time.Instant;
import java.util.List;

/**
 * Grandes Premios de una liga de Fórmula 1 con la predicción del usuario y los resultados.
 *
 * @param grandsPrix Grandes Premios de la competición, por fecha
 * @param drivers    pilotos que aparecen en las parrillas, los resultados o las predicciones
 * @param rules      puntos de cada acierto en esta liga
 */
public record GrandPrixBoardDTO(List<GrandPrix> grandsPrix, List<Driver> drivers, Rules rules) {

    /**
     * @param lockAt   cierre de la predicción: el inicio de la clasificación
     * @param status   SCHEDULED, LIVE (fin de semana en marcha), FINISHED, CANCELLED o POSTPONED
     * @param gridIds  pilotos que se pueden elegir: los inscritos o, si aún no hay lista, los de la última carrera
     * @param result   podio, pole y vuelta rápida; null hasta que hay algo
     * @param pick     predicción del usuario; null si no ha predicho
     * @param points   puntos del usuario; null mientras no se ha puntuado
     */
    public record GrandPrix(Long id, String name, String circuit, String city, String country, boolean sprint,
                            Instant lockAt, Instant raceAt, String status, boolean locked, List<Long> gridIds,
                            Picks result, Picks pick, Integer points, String details) {}

    /** Podio, pole y vuelta rápida (ids de piloto); cualquiera puede faltar. */
    public record Picks(Long first, Long second, Long third, Long pole, Long fastestLap) {}

    public record Driver(Long id, String name, String shortName, String country, String flagUrl,
                         String team, String teamColor, String number, String headshotUrl) {}

    public record Rules(int exactPosition, int podium, int pole, int fastestLap) {}

    /** Predicción de un participante, visible para el resto al cerrar el Gran Premio. */
    public record MemberPick(Long userId, String name, String avatarUrl, boolean mine, Picks pick, Integer points,
                             String details) {}

    /** Predicciones de la liga en un Gran Premio ya cerrado, para las estadísticas y el buscador. */
    public record RacePicks(Long matchId, List<MemberPick> picks) {}
}
