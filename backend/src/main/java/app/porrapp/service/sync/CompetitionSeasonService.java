package app.porrapp.service.sync;

import app.porrapp.model.Competition;
import app.porrapp.model.Match;
import app.porrapp.repository.CompetitionRepository;
import app.porrapp.repository.EditionMatchChoiceRepository;
import app.porrapp.repository.MatchPredictionRepository;
import app.porrapp.repository.MatchRepository;
import app.porrapp.service.prediction.ScoreInvalidationService;
import app.porrapp.sports.SportsDataProvider;
import app.porrapp.util.AppTime;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.CacheManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZonedDateTime;
import java.time.format.DateTimeParseException;
import java.util.List;

/**
 * Temporada de cada fila de {@code competitions}: una fila es una temporada de la competición y lleva su
 * etiqueta ("2026/27", "2026").
 * <p>
 * Antes de importar una competición se mira qué temporada da el proveedor por vigente
 * ({@link #enterSeason}): si la fila aún no tiene etiqueta y sus partidos son de esa temporada, se anota;
 * si la del proveedor es más nueva y la guardada ya no tiene nada por jugar, la fila se archiva (con sus
 * partidos, sus equipos y sus ligas, que quedan terminadas) y se crea otra con el mismo id externo.
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

    /** Una temporada que empieza más allá de esto aún no es la vigente: se espera a que se acerque. */
    static final Duration EARLIEST_START = Duration.ofDays(200);

    /** Lo que deja de valer al cambiar de temporada: el catálogo, los partidos y las tablas oficiales. */
    static final List<String> CACHES = List.of("competitions", "matches", "matchRadar", "standings",
            "competitionStandings", "f1Standings", "userGroups", "groupById", "groupByCode");

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

        /** Año en que empieza, el de su etiqueta. */
        int startYear() {
            return Integer.parseInt(label.substring(0, 4));
        }
    }

    private final CompetitionRepository competitionRepository;
    private final MatchRepository matchRepository;
    private final MatchPredictionRepository matchPredictionRepository;
    private final EditionMatchChoiceRepository editionMatchChoiceRepository;
    private final ScoreInvalidationService scoreInvalidationService;
    private final CacheManager cacheManager;

    /** Interruptor de emergencia: con {@code false} las temporadas se siguen anotando, pero ninguna se archiva. */
    @Value("${app.seasons.rollover-enabled:true}")
    private boolean rolloverEnabled = true;

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
        Competition competition = competitionRepository.findById(competitionId).orElse(null);
        return follows(competition, season) && annotate(competition, season);
    }

    /** Fila que sigue las temporadas del proveedor: oficial, vigente y con una temporada que se entiende. */
    private static boolean follows(Competition competition, Season season) {
        return season != null && competition != null && !competition.isArchived()
                && competition.getOwnerLeague() == null;
    }

    private boolean annotate(Competition competition, Season season) {
        if (competition.getSeason() != null) return false;
        Long id = competition.getId();
        if (matchRepository.existsByCompetitionIdAndMatchDateBefore(id, season.start().minus(MARGIN))
                || matchRepository.existsByCompetitionIdAndMatchDateAfter(id, season.end().plus(MARGIN))) {
            log.info("{} guarda partidos de fuera de la temporada {} del proveedor: se queda sin anotar",
                    competition.getName(), season.label());
            return false;
        }
        competition.setSeason(season.label());
        competitionRepository.save(competition);
        log.info("{} es la temporada {}", competition.getName(), season.label());
        return true;
    }

    /**
     * Pone la competición en la temporada que el proveedor da por vigente, antes de importarla.
     * <ul>
     *   <li>Sin etiqueta y con partidos de esa temporada (o sin partidos): solo se anota.</li>
     *   <li>Con una temporada más nueva en el proveedor: si la fila guarda partidos de la anterior y ninguno
     *   queda por jugar, se archiva y se crea la fila de la nueva. Los partidos de la temporada nueva que
     *   ya estuvieran importados pasan a ella, sin las predicciones hechas sobre ellos en las ligas de la
     *   temporada que termina.</li>
     *   <li>En cualquier otro caso (misma temporada, una más vieja, un dato que no se entiende) no cambia nada.</li>
     * </ul>
     *
     * @return la fila en la que hay que importar: la nueva si ha cambiado de temporada, la de siempre si no
     */
    @Transactional
    public Competition enterSeason(Long competitionId, Season season) {
        Competition current = competitionRepository.findById(competitionId).orElse(null);
        if (!follows(current, season) || annotate(current, season) || !isNewer(season, current)) return current;
        String blocker = blocker(current, season);
        if (blocker != null) {
            log.warn("{} no cambia a la temporada {}: {}", current.getName(), season.label(), blocker);
            return current;
        }
        return rollOver(current, season);
    }

    /**
     * Si la temporada del proveedor es posterior a la de la fila. Con etiqueta, por el año en que empieza
     * cada una (que el proveedor mueva unos días su calendario no cambia la etiqueta). Sin etiqueta, si la
     * fila guarda partidos claramente anteriores al inicio de la temporada del proveedor.
     */
    private boolean isNewer(Season season, Competition current) {
        if (current.getSeason() != null) {
            Integer stored = current.seasonStartYear();
            return stored != null && season.startYear() > stored;
        }
        return matchRepository.existsByCompetitionIdAndMatchDateBefore(current.getId(), season.start().minus(MARGIN));
    }

    /** Por qué no se puede cambiar de temporada todavía, o null si se puede. */
    private String blocker(Competition current, Season season) {
        if (!rolloverEnabled) return "el cambio de temporada está desactivado (app.seasons.rollover-enabled)";
        // Su temporada es la de su formato (tournament-formats.json): la edición siguiente se da de alta a mano.
        if (current.isGroupTournament()) return "es un torneo con grupos y su temporada la fija su formato";
        Instant now = Instant.now();
        if (!season.end().isAfter(now)) return "la temporada del proveedor ya habría terminado";
        if (season.start().isAfter(now.plus(EARLIEST_START))) return "la temporada del proveedor empieza demasiado lejos";
        Long id = current.getId();
        if (matchRepository.countByCompetitionIdAndMatchDateBefore(id, season.start()) == 0) {
            return "no guarda partidos de la temporada anterior";
        }
        long pending = matchRepository.countPendingBefore(id, season.start());
        return pending > 0 ? "le quedan " + pending + " partidos por jugar de la temporada anterior" : null;
    }

    private Competition rollOver(Competition old, Season season) {
        if (old.getSeason() == null) old.setSeason(storedSeasonLabel(old.getId(), season.start()));
        old.setArchivedAt(Instant.now());
        // La fila vieja deja de ser la vigente antes de crear la nueva: el id externo solo cabe en una.
        competitionRepository.saveAndFlush(old);
        Competition next = competitionRepository.saveAndFlush(Competition.builder()
                .name(old.getName())
                .externalId(old.getExternalId())
                .formatType(old.getFormatType())
                .sport(old.getSport())
                .season(season.label())
                .build());
        Long oldId = old.getId();
        Long nextId = next.getId();
        String name = old.getName();
        String oldSeason = old.getSeason();

        List<Long> moved = matchRepository.findIdsByCompetitionIdFrom(oldId, season.start());
        int deletedPredictions = 0;
        if (!moved.isEmpty()) {
            // Las ligas de la temporada que termina no juegan la siguiente: lo predicho sobre ella no cuenta.
            deletedPredictions = matchPredictionRepository.deleteByMatchIdIn(moved);
            editionMatchChoiceRepository.deleteByMatchIdIn(moved);
            matchRepository.moveToCompetition(moved, next);
            if (deletedPredictions > 0) scoreInvalidationService.invalidateCompetition(oldId);
        }
        evictCachesAfterCommit();
        log.warn("{} cambia de temporada: {} archivada (competición {}), {} vigente (competición {}); "
                        + "{} partidos pasan a la nueva y se borran {} predicciones sobre ellos",
                name, oldSeason, oldId, season.label(), nextId, moved.size(), deletedPredictions);
        return competitionRepository.findById(nextId).orElseThrow();
    }

    /** Etiqueta de una fila que se archiva sin haberla tenido: la de las fechas de sus propios partidos. */
    private String storedSeasonLabel(Long competitionId, Instant before) {
        Instant first = matchRepository.findFirstByCompetitionIdAndMatchDateBeforeOrderByMatchDateAsc(competitionId, before)
                .map(Match::getMatchDate).orElse(null);
        Instant last = matchRepository.findFirstByCompetitionIdAndMatchDateBeforeOrderByMatchDateDesc(competitionId, before)
                .map(Match::getMatchDate).orElse(null);
        return first == null || last == null ? null : labelOf(first, last.plus(Duration.ofDays(1)));
    }

    private void evictCachesAfterCommit() {
        Runnable evict = () -> CACHES.forEach(name -> {
            var cache = cacheManager.getCache(name);
            if (cache != null) cache.clear();
        });
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            evict.run();
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                evict.run();
            }
        });
    }
}
