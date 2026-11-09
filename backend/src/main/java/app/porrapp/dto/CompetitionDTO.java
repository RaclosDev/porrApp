package app.porrapp.dto;

import app.porrapp.model.Competition;
import app.porrapp.model.PoolFormat;
import app.porrapp.model.Sport;
import app.porrapp.sports.TennisTournaments;

import java.time.Instant;
import java.util.Map;

/**
 * Competición en la que se puede crear una liga.
 *
 * @param id         id interno
 * @param name       nombre visible
 * @param externalId id en el proveedor deportivo (ej. "esp.1", "fifa.world")
 * @param formatType "LEAGUE" o "TOURNAMENT"
 * @param sport      deporte, para agruparlas al crear una liga
 * @param finished   ya se han jugado todos sus partidos importados: no queda nada que pronosticar
 * @param groupStage si tiene fase de grupos; null mientras no haya partidos importados
 * @param knockoutDraw sus eliminatorias se sortean ronda a ronda (Champions, Copa del Rey…): se pueden
 *                     pronosticar como «Solo eliminatorias», ronda a ronda
 * @param groupTournament torneo con fase de grupos que se predice entero antes de empezar (grupos,
 *                        terceros y cuadro), con la forma de su {@code TournamentFormat}
 * @param tennis     torneo, categoría, cuadro y fechas de un cuadro de tenis; null en otros deportes
 * @param bracketClosesAt por formato de cuadro, cuándo empieza lo que pronostica (su primer cruce y, en el
 *                        cuadro completo, también los grupos): desde entonces no se puede crear la liga.
 *                        Vacío si se puede crear en cualquier momento
 */
public record CompetitionDTO(Long id, String name, String externalId, String formatType, Sport sport,
                             boolean finished, Boolean groupStage, boolean knockoutDraw, boolean groupTournament,
                             TennisInfo tennis,
                             Map<PoolFormat, Instant> bracketClosesAt) {

    /** Partidos importados de una competición: todos, los que faltan por terminar y los de grupos. */
    public record CalendarStats(long matches, long unfinished, long groupMatches) {
        public static final CalendarStats NONE = new CalendarStats(0, 0, 0);
    }

    /**
     * Cuadro de un torneo de tenis.
     *
     * @param tournamentId id del torneo en ESPN: los dos cuadros de un torneo lo comparten
     * @param tournament   nombre del torneo, sin el cuadro
     * @param level        GRAND_SLAM, MASTERS_1000 o FINALS
     * @param draw         MEN o WOMEN
     * @param setsToWin    sets que hay que ganar (3 en los Grand Slams masculinos)
     * @param startDate    inicio de la edición actual, null si ESPN no la tiene
     * @param endDate      fin de la edición actual
     */
    public record TennisInfo(int tournamentId, String tournament, String level, String draw, int setsToWin,
                             Instant startDate, Instant endDate) {
    }

    /** Fechas de la edición actual de un torneo de tenis (la que se juega, la próxima o la última). */
    public record TennisDates(Instant start, Instant end) {
    }

    public static CompetitionDTO of(Competition competition, CalendarStats stats) {
        return of(competition, stats, null, Instant.now(), Map.of());
    }

    /**
     * En tenis la edición la dice ESPN: un torneo cuya última edición ya ha acabado está terminado aunque
     * aún no haya partidos de la siguiente, y uno con la próxima publicada no lo está aunque la anterior
     * se jugara entera.
     */
    public static CompetitionDTO of(Competition competition, CalendarStats stats, TennisDates dates, Instant now,
                                    Map<PoolFormat, Instant> bracketClosesAt) {
        CalendarStats calendar = stats == null ? CalendarStats.NONE : stats;
        boolean imported = calendar.matches() > 0;
        TennisInfo tennis = TennisTournaments.parse(competition.getExternalId())
                .map(ref -> new TennisInfo(ref.tournament().espnId(), ref.tournament().name(),
                        ref.tournament().level().name(), ref.draw().name(), ref.setsToWin(),
                        dates == null ? null : dates.start(), dates == null ? null : dates.end()))
                .orElse(null);
        boolean finished = tennis != null && dates != null
                ? dates.end().isBefore(now) && calendar.unfinished() == 0
                // La NBA vuelve cada año: con los últimos playoffs ya jugados se espera a los siguientes.
                : imported && calendar.unfinished() == 0 && !competition.playsSeries();
        return new CompetitionDTO(competition.getId(), competition.getName(),
                competition.getExternalId(), competition.getFormatType(),
                competition.sport(),
                finished,
                tennis != null ? Boolean.FALSE : imported ? calendar.groupMatches() > 0 : null,
                competition.drawsKnockoutRounds(), competition.isGroupTournament(), tennis,
                bracketClosesAt == null ? Map.of() : Map.copyOf(bracketClosesAt));
    }
}
