package app.porrapp.service.sync;

import app.porrapp.model.Competition;
import app.porrapp.repository.CompetitionRepository;
import app.porrapp.repository.MatchRepository;
import app.porrapp.sports.SportsDataProvider;
import app.porrapp.util.AppTime;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZonedDateTime;
import java.time.format.DateTimeParseException;

/**
 * Temporada de cada fila de {@code competitions}: una fila es una temporada de la competición y lleva su
 * etiqueta ("2026/27", "2026"). Aquí se anota la que da el proveedor en la fila vigente que aún no la tiene.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class CompetitionSeasonService {

    /** Una temporada no dura más: un dato así del proveedor no se entiende y no se anota. */
    static final Duration LONGEST_SEASON = Duration.ofDays(550);

    /** Por debajo de esto es un torneo (un Grand Slam, un Mundial) y su temporada es un solo año. */
    static final Duration SHORTEST_LEAGUE = Duration.ofDays(120);

    /**
     * Margen alrededor de la temporada en el que un partido guardado sigue siendo suyo: rondas previas
     * que el proveedor deja fuera de su calendario o un partido aplazado tras el último día.
     */
    static final Duration MARGIN = Duration.ofDays(30);

    /** Temporada que el proveedor da por vigente: su etiqueta y entre qué fechas se juega. */
    public record Season(String label, Instant start, Instant end) {

        /** La de un año natural (Fórmula 1). */
        public static Season ofYear(int year) {
            return new Season(String.valueOf(year), AppTime.startOfDay(LocalDate.of(year, 1, 1)),
                    AppTime.startOfDay(LocalDate.of(year + 1, 1, 1)));
        }

        /** La que describe el proveedor, o null si no la da, no se entiende o dura lo que no dura una temporada. */
        public static Season of(SportsDataProvider.SeasonWindow window) {
            if (window == null) return null;
            Instant start = parse(window.seasonStart());
            Instant end = parse(window.end());
            if (start == null || end == null || !end.isAfter(start)) return null;
            if (Duration.between(start, end).compareTo(LONGEST_SEASON) > 0) return null;
            return new Season(labelOf(start, end), start, end);
        }
    }

    private final CompetitionRepository competitionRepository;
    private final MatchRepository matchRepository;

    /**
     * "2026/27" si la temporada va de un año al siguiente y "2026" si cabe en uno. Un torneo corto que
     * pilla el cambio de año es del año en que cae su mitad; el último día no cuenta, porque el proveedor
     * cierra las temporadas en la madrugada del día siguiente.
     */
    static String labelOf(Instant start, Instant end) {
        int first = AppTime.day(start).getYear();
        int last = AppTime.day(end.minus(Duration.ofDays(1))).getYear();
        if (last <= first) return String.valueOf(first);
        Duration length = Duration.between(start, end);
        if (length.compareTo(SHORTEST_LEAGUE) < 0) {
            return String.valueOf(AppTime.day(start.plus(length.dividedBy(2))).getYear());
        }
        return first + "/" + String.format("%02d", last % 100);
    }

    private static Instant parse(String isoDate) {
        try {
            return isoDate == null ? null : ZonedDateTime.parse(isoDate).toInstant();
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    /**
     * Anota la temporada del proveedor en la fila vigente que aún no tiene. Nunca la cambia ni archiva nada.
     * <p>
     * Solo si los partidos guardados son de esa temporada: una fila que aún guarda la anterior (el
     * proveedor ya ha pasado a la siguiente) se queda sin etiqueta en vez de llevar la que no es.
     *
     * @return si la ha anotado
     */
    @Transactional
    public boolean annotate(Long competitionId, Season season) {
        if (season == null) return false;
        Competition competition = competitionRepository.findById(competitionId).orElse(null);
        if (competition == null || competition.isArchived() || competition.getOwnerLeague() != null
                || competition.getSeason() != null) {
            return false;
        }
        if (matchRepository.existsByCompetitionIdAndMatchDateBefore(competitionId, season.start().minus(MARGIN))
                || matchRepository.existsByCompetitionIdAndMatchDateAfter(competitionId, season.end().plus(MARGIN))) {
            log.info("{} guarda partidos de fuera de la temporada {} del proveedor: se queda sin anotar",
                    competition.getName(), season.label());
            return false;
        }
        competition.setSeason(season.label());
        competitionRepository.save(competition);
        log.info("{} es la temporada {}", competition.getName(), season.label());
        return true;
    }
}
