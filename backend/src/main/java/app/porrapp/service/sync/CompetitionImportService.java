package app.porrapp.service.sync;

import app.porrapp.service.tournament.StandingsService;
import app.porrapp.service.tournament.KnockoutBracketService;
import app.porrapp.service.tournament.OfficialMatchdayService;
import app.porrapp.service.tournament.TopScorerService;
import app.porrapp.service.prediction.ScoreInvalidationService;
import app.porrapp.service.prediction.CustomLockService;
import app.porrapp.service.notification.WebSocketService;
import app.porrapp.exception.BusinessException;
import app.porrapp.model.Competition;
import app.porrapp.model.Team;
import app.porrapp.model.TournamentFormat;
import app.porrapp.repository.CompetitionRepository;
import app.porrapp.sports.SportsDataProvider;
import app.porrapp.sports.SportsDataProviderRegistry;
import app.porrapp.util.AppTime;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.JsonNode;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.TimeUnit;

/**
 * Importa el catálogo de equipos y el calendario completo de la temporada de una competición: al crear
 * una liga sobre ella y, para todas las oficiales, cada madrugada ({@link SeasonCalendarRefresher}).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class CompetitionImportService {

    /** Lo que espera una importación a que termine la sincronización en curso. */
    private static final long IMPORT_LOCK_TIMEOUT_MINUTES = 5;

    /** Resultado de importar el catálogo y calendario de una competición. */
    public record ImportResult(String competition, int importedTeams, int importedMatches) {
    }

    private final CompetitionRepository competitionRepository;
    private final SportsDataProviderRegistry sportsDataProviderRegistry;
    private final MatchEventProcessor matchEventProcessor;
    private final KnockoutBracketService knockoutBracketService;
    private final StandingsService standingsService;
    private final WebSocketService webSocketService;
    private final ScoreInvalidationService scoreInvalidationService;
    private final PlatformTransactionManager transactionManager;
    private final TopScorerService topScorerService;
    private final CustomLockService customLockService;
    private final SyncLock syncLock;
    private final OfficialMatchdayService officialMatchdayService;
    private final app.porrapp.service.formulaone.FormulaOneSyncService formulaOneSyncService;
    private final CompetitionSeasonService seasonService;

    /**
     * Importa el catálogo de equipos (con escudos) y el calendario de la temporada de una competición.
     * Se usa al crear la primera liga de una competición sin partidos.
     * <p>
     * Comparte el cerrojo de la sincronización programada, para que las dos no creen el mismo partido a
     * la vez, y lo mantiene hasta confirmar la transacción.
     */
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public ImportResult importCompetitionData(Long competitionId) {
        try {
            if (!syncLock.tryLock(IMPORT_LOCK_TIMEOUT_MINUTES, TimeUnit.MINUTES)) {
                throw new IllegalStateException("Hay una sincronización en curso; no se ha podido importar la competición " + competitionId);
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Importación interrumpida de la competición " + competitionId, e);
        }
        try {
            Competition formulaOne = competitionRepository.findById(competitionId)
                    .filter(c -> c.isFormulaOne()).orElse(null);
            if (formulaOne != null) return importFormulaOne(formulaOne);
            ImportSnapshot snapshot = downloadImport(competitionId);
            checkImportCancellation();
            // Lo descargado es de la temporada que el proveedor da por vigente: se guarda en su fila.
            Competition competition = enterSeason(snapshot.competition(), snapshot.season());
            ImportCommit committed = new TransactionTemplate(transactionManager)
                    .execute(status -> applyImport(snapshot, competition));
            if (committed == null) throw new IllegalStateException("La importación no confirmó sus datos");
            matchEventProcessor.invalidateTeamCache();
            // ESPN no numera las jornadas de liga: sin esto cada día con partidos sería una jornada.
            if (!Thread.currentThread().isInterrupted()) officialMatchdayService.numberMatchdays(competition);
            committed.batch().publishNotifications();
            if (GroupTournamentTables.applies(competition)) {
                webSocketService.notifyResultsChanged();
            } else {
                java.util.List<Long> imported = java.util.List.of(competition.getId());
                scoreInvalidationService.evictLeaderboardsAfterCommit(imported);
                webSocketService.notifyResultsChanged(imported);
            }
            if (GroupTournamentTables.applies(competition) && !Thread.currentThread().isInterrupted()) {
                topScorerService.refresh(competition);
            }
            return committed.result();
        } finally {
            syncLock.unlock();
        }
    }

    /**
     * Anota la temporada o cambia a la nueva, en su propia transacción y antes de guardar nada. Si falla,
     * la competición sigue en la fila que tenía: un cambio de temporada a medias nunca frena la importación.
     */
    private Competition enterSeason(Competition competition, CompetitionSeasonService.Season season) {
        try {
            Competition entered = seasonService.enterSeason(competition.getId(), season);
            return entered != null ? entered : competition;
        } catch (RuntimeException error) {
            log.warn("No se pudo mirar la temporada de {}: {}", competition.getName(), error.getMessage());
            return competition;
        }
    }

    /**
     * La Fórmula 1 no tiene equipos ni partidos: sus Grandes Premios los carga su propio servicio. Su
     * temporada es el año natural.
     */
    private ImportResult importFormulaOne(Competition stored) {
        Competition competition = enterSeason(stored,
                CompetitionSeasonService.Season.ofYear(LocalDate.now(AppTime.ZONE).getYear()));
        try {
            var result = formulaOneSyncService.importSeason(competition);
            if (result.updated() > 0) {
                java.util.List<Long> imported = java.util.List.of(competition.getId());
                scoreInvalidationService.evictLeaderboardsAfterCommit(imported);
                webSocketService.notifyResultsChanged(imported);
            }
            return new ImportResult(competition.getName(), 0, result.updated());
        } catch (RuntimeException error) {
            throw error;
        } catch (Exception error) {
            throw new IllegalStateException("No se pudo cargar la Fórmula 1: " + error.getMessage(), error);
        }
    }

    private static final int MAX_IMPORT_TEAMS = 1000;
    private static final int MAX_IMPORT_EVENTS = 2000;

    private record ImportSnapshot(Competition competition, JsonNode teams, List<JsonNode> events,
            CompetitionSeasonService.Season season) {}
    private record ImportCommit(ImportResult result, MatchEventProcessor.Batch batch) {}

    /** Descarga secuencial y acotada; no se abre la transacción de escritura hasta tener toda la respuesta. */
    private ImportSnapshot downloadImport(Long competitionId) {
        checkImportCancellation();
        Competition competition = competitionRepository.findById(competitionId)
                .orElseThrow(() -> BusinessException.notFound("Competición no encontrada"));
        String slug = competition.getExternalId();
        if (slug == null || slug.isBlank()) {
            throw new IllegalArgumentException("La competición no tiene proveedor externo configurado");
        }
        SportsDataProvider provider = sportsDataProviderRegistry.findProviderForCompetition(competition.getExternalId())
                .orElseThrow(() -> new IllegalArgumentException("Ningún proveedor de datos sigue " + competition.getName()));
        Set<String> seenEventIds = new HashSet<>();
        List<JsonNode> selected = new ArrayList<>();
        long deadline = System.nanoTime() + Duration.ofMinutes(2).toNanos();
        try {
            if (!provider.isAvailable()) throw new IllegalStateException("Circuit breaker abierto");
            TournamentFormat format = competition.tournamentFormat();
            // Un torneo con grupos es el de la temporada de su formato, la dé o no el proveedor por vigente.
            boolean ownSeason = format != null && format.season() != null && !format.season().isBlank();
            SportsDataProvider.SeasonWindow season = ownSeason ? null : provider.fetchSeasonWindow(slug);
            JsonNode teams = provider.fetchTeams(slug);
            if (teams == null || !teams.isArray() || teams.size() > MAX_IMPORT_TEAMS) {
                throw new IllegalStateException("Catálogo de equipos ausente o demasiado grande");
            }
            if (ownSeason) {
                // Se pide entero y de una vez, como en la sincronización: también si se jugó hace años.
                select(provider.fetchScoreboardEvents(slug, format.season()), null, seenEventIds, selected, deadline);
            } else {
                Window window = seasonWindow(season, LocalDate.now());
                for (int year = AppTime.day(window.start()).getYear(); year <= AppTime.day(window.end()).getYear(); year++) {
                    checkImportCancellation();
                    if (System.nanoTime() >= deadline) throw new IllegalStateException("Tiempo de descarga agotado");
                    if (!provider.isAvailable()) throw new IllegalStateException("Circuit breaker abierto");
                    select(provider.fetchScoreboardEvents(slug, String.valueOf(year)), window, seenEventIds, selected, deadline);
                }
            }
            checkImportCancellation();
            if (System.nanoTime() >= deadline) throw new IllegalStateException("Tiempo de descarga agotado");
            return new ImportSnapshot(competition, teams, List.copyOf(selected),
                    ownSeason ? tournamentSeason(format) : CompetitionSeasonService.Season.of(season));
        } catch (Exception error) {
            if (error instanceof InterruptedException) Thread.currentThread().interrupt();
            throw new IllegalStateException("No se pudo descargar la importación de " + competition.getName(), error);
        }
    }

    /** Añade a lo descargado los eventos nuevos de una respuesta del proveedor; con ventana, solo los de dentro. */
    private void select(JsonNode events, Window window, Set<String> seenEventIds, List<JsonNode> selected, long deadline) {
        if (System.nanoTime() >= deadline) throw new IllegalStateException("Tiempo de descarga agotado");
        if (events == null || !events.isArray() || events.size() > MAX_IMPORT_EVENTS) {
            throw new IllegalStateException("Calendario ausente o demasiado grande");
        }
        for (JsonNode event : events) {
            checkImportCancellation();
            String eventId = event.path("id").asText(null);
            if (eventId == null || eventId.isBlank()) throw new IllegalStateException("Evento sin identificador");
            if (!seenEventIds.add(eventId)) continue;
            if (seenEventIds.size() > MAX_IMPORT_EVENTS) throw new IllegalStateException("Demasiados eventos en la importación");
            Instant date = matchEventProcessor.parseDate(event.path("date").asText(null));
            if (window != null && date != null && (date.isBefore(window.start()) || date.isAfter(window.end()))) continue;
            selected.add(event);
        }
    }

    /** Temporada de un torneo con grupos: el año de su formato; null si no es un año y no se puede anotar. */
    static CompetitionSeasonService.Season tournamentSeason(TournamentFormat format) {
        return format.season().matches("[0-9]{4}")
                ? CompetitionSeasonService.Season.ofYear(Integer.parseInt(format.season())) : null;
    }

    /** Fechas entre las que se importan partidos. */
    record Window(Instant start, Instant end) {}

    /**
     * La temporada que da el proveedor, acotada a un año hacia atrás y otro hacia delante. Sin ella (o si no
     * se entiende), los tres meses pasados y el año que viene: así una liga de calendario natural o una que
     * empezó en agosto se importan enteras, y no entran temporadas viejas.
     */
    static Window seasonWindow(SportsDataProvider.SeasonWindow season, LocalDate today) {
        Instant floor = AppTime.startOfDay(today.minusMonths(12));
        Instant ceiling = AppTime.startOfDay(today.plusMonths(12));
        Instant start = season == null ? null : parse(season.start());
        Instant end = season == null ? null : parse(season.end());
        if (start == null || end == null || !end.isAfter(start)) {
            return new Window(AppTime.startOfDay(today.minusMonths(3)), ceiling);
        }
        return new Window(start.isBefore(floor) ? floor : start, end.isAfter(ceiling) ? ceiling : end);
    }

    private static Instant parse(String isoDate) {
        try {
            return isoDate == null ? null : java.time.ZonedDateTime.parse(isoDate).toInstant();
        } catch (java.time.format.DateTimeParseException e) {
            return null;
        }
    }

    private ImportCommit applyImport(ImportSnapshot snapshot, Competition target) {
        checkImportCancellation();
        Competition competition = competitionRepository.findById(target.getId()).orElseThrow();
        if (!Objects.equals(competition.getExternalId(), snapshot.competition().getExternalId())
                || competition.isArchived()) {
            throw new IllegalStateException("La competición cambió durante la descarga");
        }
        Map<String, Team> teams = matchEventProcessor.freshTeamCache();
        int importedTeams = matchEventProcessor.importTeams(snapshot.teams(), teams);
        MatchEventProcessor.Batch batch = new MatchEventProcessor.Batch(competition, true);
        for (JsonNode event : snapshot.events()) {
            checkImportCancellation();
            matchEventProcessor.process(event, teams, batch);
        }
        if (batch.resultsChanged()) {
            if (GroupTournamentTables.applies(competition)) {
                GroupTournamentTables.refresh(competition, knockoutBracketService, standingsService);
            }
            scoreInvalidationService.invalidateCompetition(competition.getId());
        }
        if (batch.matchesUpdated() > 0) customLockService.refreshFirstMatchLocks(competition.getId());
        checkImportCancellation();
        log.info("Importados {} equipos y {} partidos de {}", importedTeams, batch.matchesUpdated(), competition.getName());
        return new ImportCommit(new ImportResult(competition.getName(), importedTeams, batch.matchesUpdated()), batch);
    }

    private static void checkImportCancellation() {
        if (Thread.currentThread().isInterrupted()) throw new IllegalStateException("Importación interrumpida");
    }
}
