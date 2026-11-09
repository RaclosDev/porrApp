package app.porrapp.service.tournament;

import app.porrapp.dto.ScorerCandidateDTO;
import app.porrapp.dto.TopScorerDTO;
import app.porrapp.model.Competition;
import app.porrapp.model.CompetitionPlayer;
import app.porrapp.model.Sport;
import app.porrapp.repository.CompetitionPlayerRepository;
import app.porrapp.repository.CompetitionRepository;
import app.porrapp.repository.EditionRepository;
import app.porrapp.scoring.ScorerNameMatcher;
import app.porrapp.sports.SportsDataProvider;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Jugadores que juegan cada competición de fútbol: las plantillas de sus equipos según ESPN. De ellos se
 * elige el pichichi y contra ellos se empareja lo que se escribe a mano. Solo se piden las de las
 * competiciones en las que alguna liga juega el pichichi, una vez al día.
 */
@Service
@Slf4j
public class CompetitionPlayerService {

    /** Las plantillas cambian poco: se vuelven a pedir pasado un día. */
    static final Duration FRESH_FOR = Duration.ofHours(24);
    /** Si el proveedor no las da (aún no se han publicado), no se insiste hasta pasado este tiempo. */
    static final Duration RETRY_AFTER = Duration.ofHours(6);
    /** Tope de equipos por competición: más que eso no es una plantilla, es un catálogo equivocado. */
    private static final int MAX_TEAMS = 64;
    private static final int MAX_TEXT = 255;

    private final SportsDataProvider sportsDataProvider;
    private final CompetitionPlayerRepository playerRepository;
    private final CompetitionRepository competitionRepository;
    private final EditionRepository editionRepository;
    private final TopScorerService topScorerService;
    private final boolean refreshEnabled;

    /** Último intento de pedir las plantillas de cada competición, haya traído algo o no. */
    private final Map<Long, Instant> lastAttempt = new ConcurrentHashMap<>();

    public CompetitionPlayerService(
            @Qualifier("espnSportsDataProvider") SportsDataProvider sportsDataProvider,
            CompetitionPlayerRepository playerRepository,
            CompetitionRepository competitionRepository,
            EditionRepository editionRepository,
            TopScorerService topScorerService,
            @Value("${app.pichichi.squads-refresh:true}") boolean refreshEnabled) {
        this.sportsDataProvider = sportsDataProvider;
        this.playerRepository = playerRepository;
        this.competitionRepository = competitionRepository;
        this.editionRepository = editionRepository;
        this.topScorerService = topScorerService;
        this.refreshEnabled = refreshEnabled;
    }

    /** Jugadores de la competición con ese id; vacío si no existe o no tiene. */
    public List<ScorerCandidateDTO> players(Long competitionId) {
        return competitionRepository.findById(competitionId).map(this::players).orElse(List.of());
    }

    /**
     * Jugadores entre los que elegir el pichichi: las plantillas guardadas más los goleadores que no estén en
     * ellas (un traspasado, o una competición sin plantillas), por orden alfabético y con sus goles.
     */
    public List<ScorerCandidateDTO> players(Competition competition) {
        if (competition == null || competition.getId() == null) return List.of();
        Map<String, ScorerCandidateDTO> byKey = new LinkedHashMap<>();
        for (CompetitionPlayer player : playerRepository.findByCompetitionId(competition.getId())) {
            byKey.put(key(player.getPlayerId(), player.getName()), new ScorerCandidateDTO(player.getPlayerId(),
                    player.getName(), player.getShortName(), player.getTeam(), player.getPlayerPosition(), 0));
        }
        for (TopScorerDTO scorer : topScorerService.getTopScorers(competition)) {
            String key = key(scorer.playerId(), scorer.name());
            ScorerCandidateDTO known = byKey.get(key);
            byKey.put(key, known != null
                    ? new ScorerCandidateDTO(known.playerId(), known.name(), known.shortName(), known.team(),
                    known.position(), scorer.goals())
                    : new ScorerCandidateDTO(scorer.playerId() == null ? "" : scorer.playerId(), scorer.name(),
                    scorer.shortName(), scorer.team(), scorer.position(), scorer.goals()));
        }
        List<ScorerCandidateDTO> players = new ArrayList<>(byKey.values());
        players.sort(Comparator.comparing((ScorerCandidateDTO player) -> ScorerNameMatcher.normalize(player.name()))
                .thenComparing(ScorerCandidateDTO::team));
        return players;
    }

    /** Si se tienen las plantillas de la competición, y no solo sus goleadores. */
    public boolean squadsKnown(Competition competition) {
        return competition != null && competition.getId() != null
                && playerRepository.lastFetchedAt(competition.getId()) != null;
    }

    private static String key(String playerId, String name) {
        return playerId != null && !playerId.isBlank() ? "id:" + playerId : "name:" + ScorerNameMatcher.normalize(name);
    }

    /** Cada cinco minutos, para que una liga recién creada tenga pronto su lista; casi siempre no hay nada que pedir. */
    @Scheduled(initialDelay = 90_000, fixedDelay = 300_000)
    @SchedulerLock(name = "competitionPlayers", lockAtMostFor = "PT25M", lockAtLeastFor = "PT1M")
    public void scheduledRefresh() {
        if (!refreshEnabled) return;
        for (Competition competition : editionRepository.findCompetitionsWithPichichi()) {
            if (Thread.currentThread().isInterrupted()) return;
            refreshIfStale(competition);
        }
    }

    /** Pide las plantillas si no se tienen o son de hace más de un día, sin insistir tras un intento reciente. */
    public void refreshIfStale(Competition competition) {
        if (!hasSquads(competition)) return;
        Instant now = Instant.now();
        Instant attempted = lastAttempt.get(competition.getId());
        if (attempted != null && attempted.isAfter(now.minus(RETRY_AFTER))) return;
        Instant fetched = playerRepository.lastFetchedAt(competition.getId());
        if (fetched != null && fetched.isAfter(now.minus(FRESH_FOR))) return;
        lastAttempt.put(competition.getId(), now);
        try {
            int saved = refresh(competition);
            log.info("CompetitionPlayerService: {} jugadores de {}", saved, competition.getName());
        } catch (Exception e) {
            if (e instanceof InterruptedException) Thread.currentThread().interrupt();
            log.warn("CompetitionPlayerService: no se pudieron pedir las plantillas de {}: {}",
                    competition.getName(), e.getMessage());
        }
    }

    /** Competición oficial de fútbol vigente que sigue el proveedor. */
    private boolean hasSquads(Competition competition) {
        String externalId = competition.getExternalId();
        return competition.getId() != null && competition.getOwnerLeague() == null && !competition.isArchived()
                && externalId != null && !externalId.isBlank()
                && Sport.ofExternalId(externalId) == Sport.FOOTBALL
                && sportsDataProvider.supports(externalId);
    }

    /**
     * Pide la plantilla de cada equipo y guarda sus jugadores. Los que ya estaban se actualizan y ninguno se
     * borra: quien se va a media temporada puede seguir siendo el máximo goleador.
     *
     * @return jugadores guardados
     */
    int refresh(Competition competition) throws Exception {
        String slug = competition.getExternalId();
        JsonNode teams = sportsDataProvider.fetchTeams(slug);
        if (teams == null || !teams.isArray() || teams.size() > MAX_TEAMS) return 0;

        Map<String, CompetitionPlayer> existing = new HashMap<>();
        for (CompetitionPlayer player : playerRepository.findByCompetitionId(competition.getId())) {
            existing.put(player.getPlayerId(), player);
        }
        Instant now = Instant.now();
        Map<String, CompetitionPlayer> seen = new LinkedHashMap<>();
        for (JsonNode item : teams) {
            if (Thread.currentThread().isInterrupted()) throw new InterruptedException("Plantillas interrumpidas");
            if (!sportsDataProvider.isAvailable()) break;
            JsonNode team = item.path("team").isMissingNode() ? item : item.path("team");
            String teamId = team.path("id").asText("");
            if (teamId.isEmpty()) continue;
            JsonNode roster;
            try {
                roster = sportsDataProvider.fetchTeamRoster(slug, teamId);
            } catch (InterruptedException e) {
                throw e;
            } catch (Exception e) {
                // Un equipo sin plantilla no impide guardar las de los demás.
                log.debug("CompetitionPlayerService: sin plantilla del equipo {} de {}: {}", teamId, slug, e.getMessage());
                continue;
            }
            if (roster == null || !roster.isArray()) continue;
            String teamName = team.path("displayName").asText("");
            for (JsonNode athlete : roster) {
                String playerId = athlete.path("id").asText("");
                String name = athlete.path("displayName").asText(athlete.path("fullName").asText("")).trim();
                if (playerId.isEmpty() || name.isEmpty() || playerId.length() > MAX_TEXT) continue;
                CompetitionPlayer player = existing.getOrDefault(playerId,
                        CompetitionPlayer.builder().competitionId(competition.getId()).playerId(playerId).build());
                player.setName(fit(name));
                player.setShortName(fit(athlete.path("shortName").asText(name).trim()));
                player.setTeam(fit(teamName));
                player.setPlayerPosition(fit(athlete.path("position").path("abbreviation").asText("")));
                player.setFetchedAt(now);
                seen.put(playerId, player);
            }
        }
        if (!seen.isEmpty()) playerRepository.saveAll(seen.values());
        return seen.size();
    }

    private static String fit(String value) {
        if (value == null) return "";
        return value.length() <= MAX_TEXT ? value : value.substring(0, MAX_TEXT);
    }
}
