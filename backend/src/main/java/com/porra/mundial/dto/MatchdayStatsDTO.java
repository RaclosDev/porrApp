package com.porra.mundial.dto;

import java.time.Instant;
import java.util.List;
import tools.jackson.databind.annotation.JsonSerialize;

/**
 * Reparto de los pronósticos de una liga por jornadas en los partidos que ya han empezado.
 * Los partidos sin empezar no aparecen: sus pronósticos siguen ocultos hasta el pitido inicial.
 *
 * @param members miembros de la liga
 * @param matches partidos con pronósticos visibles, por fecha
 */
public record MatchdayStatsDTO(long members, List<MatchStats> matches) {

    /**
     * Agregado de un partido.
     *
     * @param round        jornada, con la misma etiqueta que la cartelera de jornadas
     * @param homeScore    marcador real (en directo si el partido está en juego)
     * @param predictions  pronósticos de la liga para el partido
     * @param homeWins     pronósticos con signo 1
     * @param draws        pronósticos con signo X
     * @param awayWins     pronósticos con signo 2
     * @param topScores    marcadores más repetidos, de más a menos
     * @param exactHits    aciertos del marcador exacto; null si el partido no ha terminado
     * @param signHits     aciertos del signo; null si el partido no ha terminado
     * @param methods      UFC: cuántos eligieron cada método (KO_TKO, SUBMISSION, DECISION), de más a
     *                     menos; vacío en el resto de deportes
     */
    public record MatchStats(
            Long matchId,
            String round,
            @JsonSerialize(using = MadridDateTimeSerializer.class) Instant matchDate,
            String homeTeam,
            String awayTeam,
            String homeTeamLogo,
            String awayTeamLogo,
            boolean finished,
            boolean live,
            Integer homeScore,
            Integer awayScore,
            int predictions,
            int homeWins,
            int draws,
            int awayWins,
            List<ScoreCount> topScores,
            Integer exactHits,
            Integer signHits,
            List<MethodCount> methods) {
    }

    /** Un marcador pronosticado y cuántos lo han puesto. */
    public record ScoreCount(int home, int away, int count) {
    }

    /** Un método de victoria pronosticado en una pelea de la UFC y cuántos lo han elegido. */
    public record MethodCount(String method, int count) {
    }
}
