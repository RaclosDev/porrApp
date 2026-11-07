package com.porra.mundial.dto;

import com.porra.mundial.model.Competition;
import com.porra.mundial.model.Match;
import com.porra.mundial.model.Team;

import java.util.List;

/**
 * Selección de partidos de una liga para su administración (o el calendario de sus competiciones al
 * crearla): cada partido con su jornada, si entra y si ya no se puede quitar.
 *
 * @param competitionIds     competiciones de la liga, la principal primero; con más de una, la liga
 *                           junta partidos de varias y sus jornadas son semanas
 * @param competitions       esas competiciones, con su nombre
 * @param removedPredictions predicciones borradas al guardar, de partidos abiertos que se han quitado
 * @param keptMatches        partidos que se pidió quitar pero se quedan: ya cerrados y con predicciones
 */
public record MatchSelectionDTO(String mode, List<Long> teamIds, List<Long> includedMatchIds,
                                List<Long> excludedMatchIds, List<TeamItem> teams, List<Item> matches,
                                int removedPredictions, int keptMatches, List<Long> competitionIds,
                                List<CompetitionItem> competitions) {

    public record TeamItem(Long id, String name, String logoUrl) {
        public static TeamItem of(Team team) {
            return new TeamItem(team.getId(), team.getName(), team.getLogoUrl());
        }
    }

    /** @param locked tiene partidos cerrados con predicciones en la liga: no se puede quitar */
    public record CompetitionItem(Long id, String name, String externalId, boolean locked) {
        public static CompetitionItem of(Competition competition, boolean locked) {
            return new CompetitionItem(competition.getId(), competition.getName(), competition.getExternalId(), locked);
        }
    }

    /**
     * @param round         jornada del partido en la liga (su semana si junta varias competiciones)
     * @param competitionId competición del partido
     * @param closed        ya no admite predicciones (empezado, terminado o cerrado por el modo de cierre)
     * @param locked        cerrado y con predicciones: se queda en la liga para no cambiar la clasificación
     * @param predictions   predicciones de la liga sobre este partido
     */
    public record Item(Long id, String round, String date, Long homeTeamId, String home, String homeLogo,
                       Long awayTeamId, String away, String awayLogo, Integer homeScore, Integer awayScore,
                       boolean selected, boolean closed, boolean locked, int predictions, Long competitionId) {

        public static Item of(Match match, String round, boolean selected, boolean closed, int predictions) {
            Team home = match.getHomeTeam();
            Team away = match.getAwayTeam();
            return new Item(match.getId(), round, MadridDateTimeSerializer.format(match.getMatchDate()),
                    home != null ? home.getId() : null, home != null ? home.getName() : Team.PLACEHOLDER_NAME,
                    home != null ? home.getLogoUrl() : null,
                    away != null ? away.getId() : null, away != null ? away.getName() : Team.PLACEHOLDER_NAME,
                    away != null ? away.getLogoUrl() : null,
                    match.getHomeScore(), match.getAwayScore(), selected, closed, closed && predictions > 0,
                    predictions, match.getCompetition() != null ? match.getCompetition().getId() : null);
        }
    }
}
