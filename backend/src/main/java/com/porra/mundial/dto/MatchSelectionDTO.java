package com.porra.mundial.dto;

import com.porra.mundial.model.Match;
import com.porra.mundial.model.Team;
import com.porra.mundial.util.MatchRound;

import java.util.List;

/**
 * Selección de partidos de una liga para su administración (o el calendario de una competición al
 * crearla): cada partido con su jornada, si entra y si ya no se puede quitar.
 *
 * @param removedPredictions predicciones borradas al guardar, de partidos abiertos que se han quitado
 * @param keptMatches        partidos que se pidió quitar pero se quedan: ya cerrados y con predicciones
 */
public record MatchSelectionDTO(String mode, List<Long> teamIds, List<Long> includedMatchIds,
                                List<Long> excludedMatchIds, List<TeamItem> teams, List<Item> matches,
                                int removedPredictions, int keptMatches) {

    public record TeamItem(Long id, String name, String logoUrl) {
        public static TeamItem of(Team team) {
            return new TeamItem(team.getId(), team.getName(), team.getLogoUrl());
        }
    }

    /**
     * @param closed      ya no admite predicciones (empezado, terminado o cerrado por el modo de cierre)
     * @param locked      cerrado y con predicciones: se queda en la liga para no cambiar la clasificación
     * @param predictions predicciones de la liga sobre este partido
     */
    public record Item(Long id, String round, String date, Long homeTeamId, String home, String homeLogo,
                       Long awayTeamId, String away, String awayLogo, Integer homeScore, Integer awayScore,
                       boolean selected, boolean closed, boolean locked, int predictions) {

        public static Item of(Match match, boolean selected, boolean closed, int predictions) {
            Team home = match.getHomeTeam();
            Team away = match.getAwayTeam();
            return new Item(match.getId(), MatchRound.label(match), MadridDateTimeSerializer.format(match.getMatchDate()),
                    home != null ? home.getId() : null, home != null ? home.getName() : Team.PLACEHOLDER_NAME,
                    home != null ? home.getLogoUrl() : null,
                    away != null ? away.getId() : null, away != null ? away.getName() : Team.PLACEHOLDER_NAME,
                    away != null ? away.getLogoUrl() : null,
                    match.getHomeScore(), match.getAwayScore(), selected, closed, closed && predictions > 0,
                    predictions);
        }
    }
}
