package com.porra.mundial.dto;

import com.porra.mundial.model.Match;

import java.time.LocalDateTime;

/**
 * Record DTO para enviar la información de los Partidos Reales (ESPN).
 * Es un record de Java 14+ que proporciona inmutabilidad y un constructor compacto.
 * Contiene alias snake_case y camelCase para compatibilidad con código Frontend antiguo.
 */
public record MatchResponseDTO(
        Long id,
        String home,
        String away,
        Long home_team_id,
        Long away_team_id,
        String homeLogo,
        String awayLogo,
        String homeTeamLogo,
        String awayTeamLogo,
        Integer homeScore,
        Integer awayScore,
        Integer home_score,
        Integer away_score,
        String date,
        Boolean finished,
        String round,
        String groupName,
        String winner,
        String displayClock,
        boolean isStartingSoon,
        String status
) {
    /**
     * Convierte una entidad de base de datos Match a este DTO optimizado para JSON.
     * Calcula dinámicamente si el partido está a punto de empezar en los próximos 30 minutos.
     * 
     * @param m Entidad JPA Match.
     * @return El DTO poblado.
     */
    public static MatchResponseDTO fromEntity(Match m) {
        boolean isStartingSoon = false;
        // Si el partido tiene fecha y aún no ha terminado, calculamos cuánto falta.
        if (m.getMatchDate() != null && !Boolean.TRUE.equals(m.getFinished())) {
            long diffMs = java.time.Duration.between(LocalDateTime.now(), m.getMatchDate()).toMillis();
            // Está en la franja de los próximos 30 minutos
            isStartingSoon = diffMs > 0 && diffMs <= 30 * 60 * 1000;
        }

        String homeLogo = m.getHomeTeam() != null ? m.getHomeTeam().getLogoUrl() : null;
        String awayLogo = m.getAwayTeam() != null ? m.getAwayTeam().getLogoUrl() : null;

        return new MatchResponseDTO(
                m.getId(),
                m.getHomeTeam() != null ? m.getHomeTeam().getName() : "Por definir",
                m.getAwayTeam() != null ? m.getAwayTeam().getName() : "Por definir",
                m.getHomeTeam() != null ? m.getHomeTeam().getId() : null,
                m.getAwayTeam() != null ? m.getAwayTeam().getId() : null,
                homeLogo,
                awayLogo,
                homeLogo,
                awayLogo,
                m.getHomeScore(),
                m.getAwayScore(),
                m.getHomeScore(), // Duplicado para retrocompatibilidad
                m.getAwayScore(), // Duplicado para retrocompatibilidad
                m.getMatchDate() != null ? m.getMatchDate().toString() : null,
                m.getFinished(),
                m.getRound(),
                m.getGroupName(),
                m.getWinnerTeam() != null ? m.getWinnerTeam().getName() : null,
                m.getDisplayClock(),
                isStartingSoon,
                Boolean.TRUE.equals(m.getFinished()) ? "FINISHED" : m.getStatus() != null ? m.getStatus().name() : "SCHEDULED"
        );
    }
}
