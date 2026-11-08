package com.porra.mundial.service.sync;

import com.porra.mundial.sports.NflSchedule;
import com.porra.mundial.service.prediction.MatchPredictionService;
import com.porra.mundial.service.notification.WebSocketService;
import tools.jackson.databind.JsonNode;
import com.porra.mundial.config.Constants;
import com.porra.mundial.model.Competition;
import com.porra.mundial.model.Match;
import com.porra.mundial.model.MatchStatusNormalized;
import com.porra.mundial.model.Sport;
import com.porra.mundial.model.Team;
import com.porra.mundial.repository.MatchRepository;
import com.porra.mundial.repository.TeamRepository;
import com.porra.mundial.sports.TennisDataProvider;
import com.porra.mundial.sports.UfcDataProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.HashSet;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Consumer;

/**
 * Traduce los eventos y equipos del marcador de ESPN a entidades {@link Match} y {@link Team}.
 * Solo guarda cambios reales y, cuando un partido termina, dispara la evaluación de pronósticos
 *; el sincronizador refresca los goleadores una vez al terminar la pasada.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class MatchEventProcessor {

    private static final long TEAM_CACHE_TTL_MS = 3_600_000;

    private final TeamRepository teamRepository;
    private final MatchRepository matchRepository;
    private final MatchPredictionService matchPredictionService;
    private final WebSocketService webSocketService;
    private final FightCardService fightCardService;

    /** Se sustituye entero al refrescar: quien ya tiene el mapa anterior no lo ve vaciarse a medias. */
    private volatile Map<String, Team> teamCache = new ConcurrentHashMap<>();
    private volatile long lastTeamCacheRefresh = 0;

    /** Acumula lo que cambia durante una sincronización o importación. */
    public static final class Batch {
        private final Competition competition;
        private final boolean atomic;
        private final List<Runnable> notifications = new ArrayList<>();
        private int teamsUpdated;
        private int matchesUpdated;
        /** Partidos en los que solo ha cambiado el reloj de juego. */
        private int clockUpdated;
        private boolean resultsChanged;
        private final List<String> errors = new ArrayList<>();
        /** Lo que solo se hace una vez por pasada (p. ej. revisar la cartelera de una velada). */
        private final Set<String> done = new HashSet<>();

        /** @return true la primera vez que se pide {@code key} en esta pasada */
        boolean firstTime(String key) { return done.add(key); }

        void recordError(String error) { errors.add(error); }
        boolean hasErrors() { return !errors.isEmpty(); }
        String errorMessage() { return String.join("; ", errors); }

        public Batch(Competition competition) {
            this(competition, false);
        }

        Batch(Competition competition, boolean atomic) {
            this.competition = competition;
            this.atomic = atomic;
        }

        void notifyScore(Runnable notification) {
            if (atomic) notifications.add(notification);
            else notification.run();
        }

        void publishNotifications() {
            notifications.forEach(Runnable::run);
            notifications.clear();
        }

        public int teamsUpdated() {
            return teamsUpdated;
        }

        public int matchesUpdated() {
            return matchesUpdated;
        }

        public int clockUpdated() {
            return clockUpdated;
        }

        public String competitionName() {
            return competition != null ? competition.getName() : null;
        }

        /**
         * Si ha cambiado algún resultado: equipos, marcador final, ganador, fin del partido o las
         * tarjetas de un partido terminado (el fair play desempata los grupos).
         */
        public boolean resultsChanged() {
            return resultsChanged;
        }

        void markResultsChanged() {
            resultsChanged = true;
        }
    }

    private record MatchStatus(MatchStatusNormalized normalized, boolean finished, String displayClock) {
        boolean live() { return normalized.isLive(); }
    }

    private record Competitor(JsonNode node, String nameEn, String espnId) {
    }

    private record MatchMetadata(String groupName, String round) {
    }

    private record Scores(Integer home, Integer away, Team winner) {
    }

    /** Equipos indexados por nombre, nombre en inglés e id externo; se refresca cada hora. */
    public Map<String, Team> teamCache() {
        long now = System.currentTimeMillis();
        Map<String, Team> current = teamCache;
        if (current.isEmpty() || now - lastTeamCacheRefresh > TEAM_CACHE_TTL_MS) {
            Map<String, Team> fresh = freshTeamCache();
            teamCache = fresh;
            lastTeamCacheRefresh = now;
            return fresh;
        }
        return current;
    }

    /** Entidades propias de la transacción de importación; nunca publica datos sin confirmar en la caché global. */
    Map<String, Team> freshTeamCache() {
        Map<String, Team> fresh = new ConcurrentHashMap<>();
        teamRepository.findAll().stream().filter(team -> team.getCompetition() == null).forEach(team -> {
            if (team.getName() != null) fresh.put(team.getName(), team);
            if (team.getNameEn() != null) fresh.put(team.getNameEn(), team);
            if (team.getExternalId() != null) fresh.put(team.getExternalId(), team);
        });
        return fresh;
    }

    void invalidateTeamCache() {
        teamCache = new ConcurrentHashMap<>();
        lastTeamCacheRefresh = 0;
    }

    /**
     * Guarda los equipos (con escudo) del catálogo de una competición.
     * <p>
     * Un equipo que ya existe conserva su nombre: los cuadros de los participantes guardan los nombres en
     * español y se puntúan comparándolos con el de cada equipo, así que cambiar «España» por el
     * «Spain» del proveedor dejaría sin puntos a todo el que la eligió.
     *
     * @return número de equipos importados
     */
    public int importTeams(JsonNode teamsNode, Map<String, Team> cache) {
        if (teamsNode == null || !teamsNode.isArray()) return 0;
        int imported = 0;
        for (JsonNode item : teamsNode) {
            JsonNode t = item.path("team").isMissingNode() ? item : item.path("team");
            String id = t.path("id").asText(null);
            String displayName = t.path("displayName").asText(t.path("name").asText(null));
            if (displayName == null || displayName.isBlank()) continue;

            String localName = Constants.getLocalName(displayName);
            String logo = t.path("logos").path(0).path("href").asText(t.path("logo").asText(null));

            Team team = teamRepository.findByName(localName)
                    .or(() -> id != null ? teamRepository.findByExternalId(id) : Optional.empty())
                    .or(() -> teamRepository.findByName(displayName))
                    .orElseGet(() -> Team.builder().name(localName).groupName("-").build());
            team.setNameEn(displayName);
            if (id != null) team.setExternalId(id);
            if (logo != null && !logo.isBlank()) team.setLogoUrl(logo);

            teamRepository.save(team);
            cache.put(team.getName(), team);
            cache.put(displayName, team);
            if (id != null) cache.put(id, team);
            imported++;
        }
        return imported;
    }

    /** Crea o actualiza el partido descrito por un evento del marcador. */
    public void process(JsonNode event, Map<String, Team> cache, Batch batch) {
        String eventId = event.path("id").asText(null);
        JsonNode competition = event.path("competitions").get(0);
        if (eventId == null || competition == null) return;

        JsonNode competitors = competition.path("competitors");
        if (!competitors.isArray() || competitors.size() < 2) return;

        Competitor home = findCompetitor(competitors, "home");
        Competitor away = findCompetitor(competitors, "away");
        Team homeTeam = resolveTeam(home, cache, batch);
        Team awayTeam = resolveTeam(away, cache, batch);
        // Huecos del calendario sin ningún rival conocido: no se guardan.
        if (Team.isPlaceholder(homeTeam) && Team.isPlaceholder(awayTeam)) return;
        boolean nfl = batch.competition != null && NflSchedule.isNfl(batch.competition.getExternalId());
        // Pretemporada y Pro Bowl no se pronostican.
        if (nfl && NflSchedule.isExcluded(event)) return;

        MatchStatus status = parseStatus(competition, playsQuarters(batch.competition));
        Scores scores = parseScores(competition, home, away, homeTeam, awayTeam, status);
        // Una pelea de la UFC va en la ronda de su velada y lleva sus datos de pelea aparte.
        JsonNode fight = event.path("ufc").isObject() ? event.path("ufc") : null;
        MatchMetadata metadata = fight != null
                ? new MatchMetadata(null, fight.path("eventName").asText(null))
                : nfl
                        ? new MatchMetadata(null, NflSchedule.roundLabel(event))
                        : parseMetadata(competition, event.path("season").path("slug").asText(""), batch.competition);
        int[] fairPlay = fight != null ? new int[]{0, 0} : fairPlayPoints(competition, home, away, homeTeam, awayTeam);

        upsertMatch(eventId, homeTeam, awayTeam, scores, fairPlay, parseDate(event.path("date").asText(null)),
                status, metadata, fight, batch);
    }

    /** Fecha del evento en hora peninsular española, o null si no se puede interpretar. */
    public Instant parseDate(String isoDate) {
        if (isoDate == null) return null;
        try {
            return ZonedDateTime.parse(isoDate).toInstant();
        } catch (java.time.format.DateTimeParseException e) {
            log.debug("Fecha no interpretable '{}': {}", isoDate, e.getMessage());
            return null;
        }
    }

    /** La NBA y la NFL se juegan por cuartos: su reloj en directo lleva el cuarto. */
    private static boolean playsQuarters(Competition competition) {
        if (competition == null || competition.getOwnerLeague() != null) return false;
        Sport sport = Sport.ofExternalId(competition.getExternalId());
        return sport == Sport.BASKETBALL || sport == Sport.AMERICAN_FOOTBALL;
    }

    private MatchStatus parseStatus(JsonNode competition, boolean quarters) {
        JsonNode type = competition.path("status").path("type");
        String name = type.path("name").asText("").toUpperCase(Locale.ROOT).replace("STATUS_", "");
        MatchStatusNormalized normalized = switch (name) {
            case "CANCELED", "CANCELLED" -> MatchStatusNormalized.CANCELLED;
            case "POSTPONED" -> MatchStatusNormalized.POSTPONED;
            case "SUSPENDED" -> MatchStatusNormalized.SUSPENDED;
            case "ABANDONED" -> MatchStatusNormalized.ABANDONED;
            case "HALFTIME" -> MatchStatusNormalized.PAUSED;
            default -> MatchStatusNormalized.fromExternal(type.path("state").asText(""),
                    type.path("completed").asBoolean(false));
        };
        return new MatchStatus(normalized, normalized == MatchStatusNormalized.FINISHED,
                MatchClock.of(competition, normalized, quarters));
    }

    private Competitor findCompetitor(JsonNode competitors, String homeAway) {
        for (JsonNode node : competitors) {
            if (homeAway.equals(node.path("homeAway").asText())) {
                String name = node.path("team").path("displayName").asText(null);
                String id = node.path("team").path("id").asText(null);
                return name != null && id != null ? new Competitor(node, name, id) : null;
            }
        }
        return null;
    }

    /** Equipo conocido (actualizando su nombre en inglés e id externo) o el comodín "Por definir". */
    private Team resolveTeam(Competitor competitor, Map<String, Team> cache, Batch batch) {
        Team team = competitor != null ? findTeam(competitor, cache) : null;
        if (team == null && competitor != null && competitor.espnId().startsWith(TennisDataProvider.ID_PREFIX)) {
            // Un tenista que no estaba en el cuadro importado (previa, lucky loser) o de un cuadro aún sin
            // importar: el partido ya trae su nombre y su bandera.
            team = teamRepository.save(Team.builder().name(competitor.nameEn()).nameEn(competitor.nameEn())
                    .externalId(competitor.espnId()).groupName("-")
                    .logoUrl(competitor.node().path("team").path("logo").asText(null)).build());
            cache.put(competitor.nameEn(), team);
            cache.put(competitor.espnId(), team);
            batch.teamsUpdated++;
            return team;
        }
        if (team == null) return placeholderTeam(cache);

        boolean changed = false;
        if (!Objects.equals(team.getNameEn(), competitor.nameEn())) {
            team.setNameEn(competitor.nameEn());
            changed = true;
        }
        if (!Objects.equals(team.getExternalId(), competitor.espnId())) {
            team.setExternalId(competitor.espnId());
            changed = true;
        }
        if (changed) {
            teamRepository.save(team);
            cache.put(competitor.nameEn(), team);
            cache.put(competitor.espnId(), team);
            batch.teamsUpdated++;
        }
        return team;
    }

    private Team findTeam(Competitor competitor, Map<String, Team> cache) {
        if (UfcDataProvider.isFighterId(competitor.espnId())) return fighter(competitor, cache);
        String localName = Constants.getLocalName(competitor.nameEn());
        for (String key : new String[]{localName, competitor.nameEn(), competitor.espnId()}) {
            if (key != null && cache.containsKey(key)) return cache.get(key);
        }
        if (localName == null) return null;
        Team team = teamRepository.findByName(localName).orElse(null);
        if (team != null) cache.put(localName, team);
        return team;
    }

    /**
     * Luchador de la UFC por su id de ESPN (dos luchadores pueden llamarse igual), dado de alta la primera
     * vez que aparece en una cartelera: no hay catálogo de luchadores que importar antes.
     */
    private Team fighter(Competitor competitor, Map<String, Team> cache) {
        Team cached = cache.get(competitor.espnId());
        if (cached != null && competitor.espnId().equals(cached.getExternalId())) return cached;
        Team team = teamRepository.findByExternalId(competitor.espnId()).orElseGet(() -> {
            String logo = competitor.node().path("team").path("logo").asText(null);
            return teamRepository.save(Team.builder()
                    .name(competitor.nameEn())
                    .nameEn(competitor.nameEn())
                    .externalId(competitor.espnId())
                    .logoUrl(logo)
                    .groupName("-")
                    .build());
        });
        cache.put(competitor.espnId(), team);
        return team;
    }

    private Team placeholderTeam(Map<String, Team> cache) {
        Team cached = cache.get(Team.PLACEHOLDER_NAME);
        if (cached != null) return cached;
        Team placeholder = teamRepository.findByName(Team.PLACEHOLDER_NAME)
                .orElseGet(() -> teamRepository.save(Team.builder()
                        .name(Team.PLACEHOLDER_NAME)
                        .nameEn(Team.PLACEHOLDER_NAME_EN)
                        .groupName("-")
                        .winOdds(1.0)
                        .qualifyOdds(1.0)
                        .outrightOdds(1.0)
                        .build()));
        cache.put(Team.PLACEHOLDER_NAME, placeholder);
        cache.put(Team.PLACEHOLDER_NAME_EN, placeholder);
        return placeholder;
    }

    /** El partido decide el cruce: es partido único o el último de la serie (la vuelta). */
    static boolean decidesTie(JsonNode competition) {
        int total = competition.path("series").path("totalCompetitions").asInt(1);
        int leg = competition.path("leg").path("value").asInt(total);
        return total <= 1 || leg >= total;
    }

    private Scores parseScores(JsonNode competition, Competitor home, Competitor away, Team homeTeam, Team awayTeam,
                               MatchStatus status) {
        if (!status.live() && !status.finished() || home == null || away == null) {
            return new Scores(null, null, null);
        }
        Integer homeScore = null;
        Integer awayScore = null;
        try {
            homeScore = Integer.parseInt(home.node().path("score").asText(""));
            awayScore = Integer.parseInt(away.node().path("score").asText(""));
        } catch (NumberFormatException ignored) {
            // Marcador aún no disponible.
        }
        // En la ida de un cruce a doble partido "winner" es quien gana ese partido, no quien pasa: el
        // ganador del cruce solo llega con "advance" en el partido que lo decide.
        boolean decides = decidesTie(competition);
        boolean advance = home.node().has("advance") || away.node().has("advance");
        boolean homeWins = advance ? home.node().path("advance").asBoolean(false)
                : decides && home.node().path("winner").asBoolean(false);
        boolean awayWins = advance ? away.node().path("advance").asBoolean(false)
                : decides && away.node().path("winner").asBoolean(false);
        Team winner = homeWins && !awayWins ? homeTeam : (awayWins && !homeWins ? awayTeam : null);
        return new Scores(homeScore, awayScore, winner);
    }

    /** Rondas eliminatorias, que una competición de liga (Champions…) también guarda. */
    private static final java.util.Set<String> KNOCKOUT_ROUNDS = java.util.Set.of("playoff", "r32", "r16", "qf", "sf", "third", "final");

    public static boolean isKnockoutRound(String round) {
        return round != null && KNOCKOUT_ROUNDS.contains(round);
    }

    /** Ronda que ESPN indica en {@code season.slug}; null si el evento no la trae o no se reconoce. */
    static String roundFromSlug(String slug) {
        return switch (slug == null ? "" : slug.toLowerCase()) {
            case "play-in" -> "playin";
            case "group-stage" -> "group";
            // Fase de grupos de las ATP Finals: sin grupos con nombre, se agrupa como una ronda.
            case "round-robin" -> "roundrobin";
            // Rondas previas de la Copa del Rey: no son fase de grupos ni entran en el cuadro.
            case "qualifying-round", "preliminary-round" -> "qualifying";
            case "first-round" -> "round1";
            case "second-round" -> "round2";
            case "knockout-round-playoffs" -> "playoff";
            case "round-of-32" -> "r32";
            case "round-of-16" -> "r16";
            case "quarterfinals" -> "qf";
            case "semifinals" -> "sf";
            case "3rd-place-match", "third-place-match" -> "third";
            case "final" -> "final";
            default -> null;
        };
    }

    /**
     * Grupo y ronda del evento. La ronda sale del {@code season.slug} de ESPN y, si no lo trae,
     * de sus notas ("3rd-Place Match" se lee igual que "3rd place match"). Las ligas no tienen ronda.
     */
    private MatchMetadata parseMetadata(JsonNode competition, String seasonSlug, Competition comp) {
        String altNote = competition.path("altGameNote").asText("");
        String note = (altNote + " " + competition.path("notes")).toLowerCase().replace('-', ' ');

        String group = null;
        if (altNote.contains("Group ")) {
            group = altNote.substring(altNote.indexOf("Group ") + 6).trim();
            if (group.length() > 2) group = group.substring(0, 1);
            group = group.toUpperCase();
        }
        String round = roundFromSlug(seasonSlug);
        if (comp != null && "LEAGUE".equalsIgnoreCase(comp.getFormatType())) {
            // La fase de liga va por jornadas; las eliminatorias que la siguen (Champions…) guardan su ronda.
            return new MatchMetadata(group, isKnockoutRound(round) ? round : null);
        }

        if (round != null) {
            return new MatchMetadata(group, round);
        }
        if (group != null || note.contains("group ") || note.contains("grupo ")) {
            round = "group";
        } else if (note.contains("round of 32") || note.contains("16avo") || note.contains("dieciseis")) {
            round = "r32";
        } else if (note.contains("round of 16") || note.contains("octav")) {
            round = "r16";
        } else if (note.contains("quarter") || note.contains("cuart") || note.contains("qf")) {
            round = "qf";
        } else if (note.contains("semi") || note.contains("sf")) {
            round = "sf";
        } else if (note.contains("third place") || note.contains("3rd place") || note.contains("tercer puesto") || note.contains("3er puesto")) {
            round = "third";
        } else if (note.contains("final") && !note.contains("quarter") && !note.contains("octav") && !note.contains("third") && !note.contains("tercer")) {
            round = "final";
        } else {
            round = "group";
        }
        return new MatchMetadata(group, round);
    }

    public static final String MATCHDAY_PREFIX = "Jornada ";
    /** Separación máxima entre partidos de una misma jornada. */
    private static final long SAME_MATCHDAY_DAYS = 4;
    /** Más allá de este parón se da por empezada otra temporada y no se sigue numerando. */
    private static final long NEW_SEASON_GAP_DAYS = 45;

    /**
     * Jornada de un partido de liga nuevo, siguiendo la numeración "Jornada N" que ya tenga la competición:
     * va a la última jornada si aún le faltan partidos y está a pocos días; si no, a la siguiente.
     * Null si la competición no numera jornadas o el partido no encaja (aplazado antiguo, temporada nueva).
     */
    String inferLeagueMatchday(Competition competition, Instant date) {
        if (competition == null || competition.getId() == null || date == null
                || !"LEAGUE".equalsIgnoreCase(competition.getFormatType())) {
            return null;
        }
        List<Match> numbered = matchRepository.findByCompetitionIdAndRoundStartingWith(competition.getId(), MATCHDAY_PREFIX);
        int latest = 0;
        for (Match m : numbered) latest = Math.max(latest, matchdayNumber(m.getRound()));
        if (latest == 0) return null;

        Set<Long> teams = new HashSet<>();
        Instant latestStart = null;
        Instant latestEnd = null;
        int latestCount = 0;
        for (Match m : numbered) {
            if (m.getHomeTeam() != null && !Team.isPlaceholder(m.getHomeTeam())) teams.add(m.getHomeTeam().getId());
            if (m.getAwayTeam() != null && !Team.isPlaceholder(m.getAwayTeam())) teams.add(m.getAwayTeam().getId());
            if (matchdayNumber(m.getRound()) != latest) continue;
            latestCount++;
            Instant d = m.getMatchDate();
            if (d == null) continue;
            if (latestStart == null || d.isBefore(latestStart)) latestStart = d;
            if (latestEnd == null || d.isAfter(latestEnd)) latestEnd = d;
        }
        if (latestEnd == null || date.isBefore(latestStart) || date.isAfter(latestEnd.plus(NEW_SEASON_GAP_DAYS, ChronoUnit.DAYS))) {
            return null;
        }
        int matchesPerMatchday = Math.max(1, teams.size() / 2);
        boolean fitsLatest = latestCount < matchesPerMatchday && !date.isAfter(latestEnd.plus(SAME_MATCHDAY_DAYS, ChronoUnit.DAYS));
        return MATCHDAY_PREFIX + (fitsLatest ? latest : latest + 1);
    }

    private static int matchdayNumber(String round) {
        if (round == null || !round.startsWith(MATCHDAY_PREFIX)) return 0;
        try {
            return Integer.parseInt(round.substring(MATCHDAY_PREFIX.length()).trim());
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private void upsertMatch(String eventId, Team home, Team away, Scores scores, int[] fairPlay,
                             Instant date, MatchStatus status, MatchMetadata meta, JsonNode fight, Batch batch) {
        Match match = matchRepository.findByExternalId(eventId)
                .orElseGet(() -> Match.builder().externalId(eventId).build());
        Team previousHome = match.getId() == null ? null : match.getHomeTeam();
        Team previousAway = match.getId() == null ? null : match.getAwayTeam();

        boolean updated = match.getId() == null;
        boolean scoreChanged = !Objects.equals(match.getHomeScore(), scores.home())
                || !Objects.equals(match.getAwayScore(), scores.away());

        if (match.getCompetition() == null && batch.competition != null) {
            match.setCompetition(batch.competition);
            updated = true;
        }
        boolean homeChanged = setTeamIfChanged(match.getHomeTeam(), home, match::setHomeTeam);
        boolean awayChanged = setTeamIfChanged(match.getAwayTeam(), away, match::setAwayTeam);
        boolean winnerChanged = setTeamIfChanged(match.getWinnerTeam(), scores.winner(), match::setWinnerTeam);
        updated |= homeChanged | awayChanged | winnerChanged;
        updated |= setIfChanged(match.getHomeScore(), scores.home(), match::setHomeScore);
        updated |= setIfChanged(match.getAwayScore(), scores.away(), match::setAwayScore);
        updated |= setIfChanged(match.getMatchDate(), date, match::setMatchDate);
        boolean finishedChanged = setIfChanged(match.getFinished(), status.finished(), match::setFinished);
        updated |= finishedChanged;
        // El reloj cambia en cada pasada mientras se juega: no cuenta como cambio de datos.
        boolean clockChanged = setIfChanged(match.getDisplayClock(), status.displayClock(), match::setDisplayClock);
        if (meta.groupName() != null) {
            updated |= setIfChanged(match.getGroupName(), meta.groupName(), match::setGroupName);
        }
        // La ronda "group" es la de por defecto: nunca sobrescribe una ronda ya asignada.
        if (meta.round() != null && !"group".equals(meta.round())) {
            updated |= setIfChanged(match.getRound(), meta.round(), match::setRound);
        }
        // ESPN no da el número de jornada de las ligas: un partido nuevo hereda la numeración existente.
        if (match.getId() == null && (match.getRound() == null || match.getRound().isBlank())) {
            String matchday = inferLeagueMatchday(batch.competition, date);
            if (matchday != null) match.setRound(matchday);
        }
        boolean fairPlayChanged = setIfChanged(match.getHomeFairPlay(), fairPlay[0], match::setHomeFairPlay)
                | setIfChanged(match.getAwayFairPlay(), fairPlay[1], match::setAwayFairPlay);
        updated |= fairPlayChanged;

        MatchStatusNormalized normalized = status.normalized();
        boolean statusChanged = setIfChanged(match.getStatus(), normalized, match::setStatus);
        updated |= statusChanged;

        if (updated) {
            matchRepository.save(match);
            batch.matchesUpdated++;
            if (homeChanged || awayChanged || winnerChanged || finishedChanged
                    || ((status.finished() || status.live()) && (scoreChanged || fairPlayChanged))) {
                batch.markResultsChanged();
            }
            if (scoreChanged) {
                Long matchId = match.getId();
                String homeName = teamName(match.getHomeTeam());
                String awayName = teamName(match.getAwayTeam());
                batch.notifyScore(() -> webSocketService.broadcastMatchScore(matchId, homeName, awayName,
                        scores.home(), scores.away(), normalized == MatchStatusNormalized.LIVE ? "IN_PLAY" : normalized.name()));
            }
        } else if (clockChanged) {
            matchRepository.save(match);
            batch.clockUpdated++;
        }

        // Datos de pelea (método, asalto) y cambios de cartelera de la UFC, antes de puntuar.
        boolean fightResultChanged = fight != null && fightCardService.apply(match, fight, previousHome, previousAway, batch);
        if (fightResultChanged) batch.markResultsChanged();

        if (status.finished() || status.live()) {
            // El cambio de estado (empieza el partido) también cuenta: en superviviente puede cerrar
            // una jornada y eliminar a quien no eligió equipo.
            evaluateScoredMatch(match, scoreChanged || finishedChanged || statusChanged || fightResultChanged
                    || matchPredictionService.hasUnscoredPredictions(match.getId()), batch.atomic);
        }
    }

    /**
     * Actualiza los puntos provisionales durante el partido y los definitivos al acabar.
     */
    private void evaluateScoredMatch(Match match, boolean resultChanged, boolean atomic) {
        try {
            if (resultChanged || matchPredictionService.hasUnscoredPredictions(match.getId())) {
                log.info("Evaluando pronósticos de {} - {} ({}-{})", teamName(match.getHomeTeam()),
                        teamName(match.getAwayTeam()), match.getHomeScore(), match.getAwayScore());
                matchPredictionService.evaluatePredictionsForMatch(match);
            }
        } catch (Exception e) {
            if (atomic) throw new IllegalStateException("Falló la puntuación de un partido importado", e);
            log.warn("Falló la evaluación de pronósticos del partido", e);
        }

    }

    private static String teamName(Team team) {
        return team != null ? team.getName() : null;
    }

    private static <T> boolean setIfChanged(T current, T value, Consumer<T> setter) {
        if (Objects.equals(current, value)) return false;
        setter.accept(value);
        return true;
    }

    /**
     * Compara equipos por id: el partido se carga en cada pasada con instancias nuevas de sus equipos,
     * distintas de las de la caché, y compararlas por referencia daría siempre un cambio.
     */
    private static boolean setTeamIfChanged(Team current, Team value, Consumer<Team> setter) {
        boolean same = current == value
                || (current != null && value != null && current.getId() != null
                        && current.getId().equals(value.getId()));
        if (same) return false;
        setter.accept(value);
        return true;
    }

    /**
     * Puntos de fair play (desempate de grupos) de cada equipo:
     * amarilla -1, segunda amarilla -2 adicional, roja directa -4.
     */
    private int[] fairPlayPoints(JsonNode competition, Competitor home, Competitor away, Team homeTeam, Team awayTeam) {
        int[] points = {0, 0};
        JsonNode details = competition.path("details");
        if (!details.isArray()) return points;

        String homeEspnId = home != null ? home.espnId() : null;
        String awayEspnId = away != null ? away.espnId() : null;
        Set<String> booked = new HashSet<>();
        for (JsonNode detail : details) {
            boolean yellow = detail.path("yellowCard").asBoolean(false);
            boolean red = detail.path("redCard").asBoolean(false);
            if (!yellow && !red) continue;

            JsonNode athletes = detail.path("athletesInvolved");
            String playerId = athletes.isArray() && !athletes.isEmpty() ? athletes.get(0).path("id").asText(null) : null;
            int penalty = red ? -4 : (playerId != null && !booked.add(playerId) ? -2 : -1);

            String teamId = detail.path("team").path("id").asText(null);
            if (teamId != null && (teamId.equals(homeEspnId) || Objects.equals(homeTeam.getExternalId(), teamId))) {
                points[0] += penalty;
            } else if (teamId != null && (teamId.equals(awayEspnId) || Objects.equals(awayTeam.getExternalId(), teamId))) {
                points[1] += penalty;
            }
        }
        return points;
    }
}
