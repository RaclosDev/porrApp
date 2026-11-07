package com.porra.mundial.service.prediction;

import com.porra.mundial.dto.MatchSelectionDTO;
import com.porra.mundial.dto.MatchSelectionRequest;
import com.porra.mundial.exception.BusinessException;
import com.porra.mundial.model.Competition;
import com.porra.mundial.model.Edition;
import com.porra.mundial.model.EditionFollowedTeam;
import com.porra.mundial.model.EditionMatchChoice;
import com.porra.mundial.model.Match;
import com.porra.mundial.model.MatchSelectionMode;
import com.porra.mundial.model.PoolFormat;
import com.porra.mundial.model.Team;
import com.porra.mundial.repository.CompetitionRepository;
import com.porra.mundial.repository.EditionFollowedTeamRepository;
import com.porra.mundial.repository.EditionMatchChoiceRepository;
import com.porra.mundial.repository.EditionRepository;
import com.porra.mundial.repository.MatchPredictionRepository;
import com.porra.mundial.repository.MatchRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Qué partidos de su competición oficial entran en una liga por jornadas: todos, o los de unos equipos
 * (también los que ESPN cargue más tarde) más o menos los elegidos a mano.
 *
 * <p>Cambiar la selección nunca cambia la clasificación: un partido ya cerrado con predicciones no se
 * puede quitar (se queda en la liga), y al quitar un partido aún abierto se borran sus predicciones en
 * esta liga, que todavía no daban puntos. Añadir un partido ya jugado no cambia nada: nadie lo predijo.
 * Los cierres por día o por jornada siguen el calendario de la liga; un cambio que reabriría un partido
 * con predicciones o cerraría antes de tiempo uno abierto conserva o descarta el partido que lo causa.</p>
 */
@Service
@RequiredArgsConstructor
public class MatchSelectionService {
    private final EditionRepository editionRepository;
    private final CompetitionRepository competitionRepository;
    private final MatchRepository matchRepository;
    private final MatchPredictionRepository matchPredictionRepository;
    private final EditionFollowedTeamRepository followedTeamRepository;
    private final EditionMatchChoiceRepository choiceRepository;
    private final ScoreInvalidationService scoreInvalidationService;

    /** Si la liga elige sus partidos; si no, entran todos y no hace falta consultar nada. */
    public static boolean selects(Edition edition) {
        return edition != null && edition.getMatchSelection() == MatchSelectionMode.CUSTOM;
    }

    /** Selección guardada de una edición; sin consultas cuando entran todos los partidos. */
    @Transactional(readOnly = true)
    public MatchSelection of(Edition edition) {
        if (edition == null || edition.getId() == null || edition.getMatchSelection() != MatchSelectionMode.CUSTOM) {
            return MatchSelection.ALL;
        }
        Set<Long> included = new HashSet<>();
        Set<Long> excluded = new HashSet<>();
        for (EditionMatchChoice choice : choiceRepository.findByEditionId(edition.getId())) {
            (choice.isIncluded() ? included : excluded).add(choice.getId().getMatchId());
        }
        return new MatchSelection(MatchSelectionMode.CUSTOM,
                new HashSet<>(followedTeamRepository.findTeamIds(edition.getId())), included, excluded);
    }

    /** Los partidos de la lista que entran en la liga. */
    @Transactional(readOnly = true)
    public List<Match> filter(Edition edition, List<Match> matches) {
        return of(edition).filter(matches);
    }

    /**
     * Calendario con el que se calcula el cierre por día o por jornada: el de la liga. Sin selección,
     * el de la competición tal cual. Estático para no consultar nada en las ligas que no eligen.
     */
    public static List<Match> leagueCalendar(MatchSelectionService service, Edition edition, List<Match> competition) {
        return selects(edition) ? service.filter(edition, competition) : competition;
    }

    /** Si un partido entra en la liga. */
    @Transactional(readOnly = true)
    public boolean contains(Edition edition, Match match) {
        return of(edition).contains(match);
    }

    /** Calendario de una competición oficial para elegir partidos al crear una liga: entran todos. */
    @Transactional(readOnly = true)
    public MatchSelectionDTO competitionCalendar(Long competitionId) {
        Competition competition = competitionRepository.findById(competitionId)
                .filter(item -> item.getOwnerLeague() == null)
                .orElseThrow(() -> BusinessException.notFound("Competición no encontrada"));
        List<Match> calendar = matchRepository.findByCompetitionId(competition.getId());
        Instant now = Instant.now();
        List<MatchSelectionDTO.Item> items = sorted(calendar).stream()
                .map(match -> MatchSelectionDTO.Item.of(match, true, startedOrClosed(match, null, now), 0))
                .toList();
        return new MatchSelectionDTO(MatchSelectionMode.ALL.name(), List.of(), List.of(), List.of(),
                teams(calendar), items, 0, 0);
    }

    /** Selección de la liga para su administrador. */
    @Transactional(readOnly = true)
    public MatchSelectionDTO view(Long leagueId, String email) {
        Edition edition = adminEdition(leagueId, email);
        return view(edition, matchRepository.findByCompetitionId(edition.getCompetition().getId()), 0, 0);
    }

    @Transactional
    @CacheEvict(value = {"userGroups", "groupById", "groupByCode"}, allEntries = true)
    public MatchSelectionDTO update(Long leagueId, String email, MatchSelectionRequest request) {
        Edition edition = adminEdition(leagueId, email);
        if (edition.isLocked()) throw BusinessException.conflict("La liga ya está cerrada");
        return apply(edition, request);
    }

    /**
     * Guarda la selección de una edición ya comprobada (también al crear la liga). Valida que los
     * equipos y partidos sean de su competición y protege los partidos cerrados con predicciones.
     */
    @Transactional
    public MatchSelectionDTO apply(Edition edition, MatchSelectionRequest request) {
        requireSelectable(edition);
        List<Match> calendar = matchRepository.findByCompetitionId(edition.getCompetition().getId());
        Set<Long> matchIds = calendar.stream().map(Match::getId).collect(Collectors.toSet());
        Set<Long> teamIds = teams(calendar).stream().map(MatchSelectionDTO.TeamItem::id).collect(Collectors.toSet());

        MatchSelectionMode mode = request.mode();
        Set<Long> requestedTeams = new HashSet<>(request.teamIdsOrEmpty());
        if (!teamIds.containsAll(requestedTeams)) {
            throw BusinessException.badRequest("Algún equipo no juega en la competición de la liga");
        }
        Set<Long> requestedMatches = new HashSet<>(request.includedOrEmpty());
        requestedMatches.addAll(request.excludedOrEmpty());
        if (!matchIds.containsAll(requestedMatches)) {
            throw BusinessException.badRequest("Algún partido no es de la competición de la liga");
        }
        MatchSelection requested = new MatchSelection(mode, requestedTeams,
                new HashSet<>(request.includedOrEmpty()), new HashSet<>(request.excludedOrEmpty()));

        MatchSelection before = of(edition);
        Map<Long, Integer> predictions = predictionCounts(edition);
        Instant now = Instant.now();
        // Cierre de cada partido con la selección actual (la jornada o el día son los de la liga).
        Map<Long, Instant> beforeLocks = MatchdayLock.lockTimes(edition, calendar, before.filter(calendar));
        Function<Match, Object> group = MatchdayLock.groupKey(edition);

        Map<Long, Match> wanted = new LinkedHashMap<>();
        int kept = 0;
        for (Match match : calendar) {
            boolean in = requested.contains(match);
            if (!in && before.contains(match) && predictions.getOrDefault(match.getId(), 0) > 0
                    && startedOrClosed(match, beforeLocks.get(match.getId()), now)) {
                // Ya cerrado con predicciones: quitarlo cambiaría la clasificación.
                in = true;
                kept++;
            }
            if (in) wanted.put(match.getId(), match);
        }

        // Con cierre por día o por jornada, quitar o añadir partidos mueve el cierre de los demás del
        // grupo. Nunca se reabre un partido con predicciones (ya se ven las de los demás) ni se cierra
        // antes de tiempo uno abierto: se conservan los quitados o se descartan los añadidos culpables.
        boolean changed = true;
        while (changed) {
            changed = false;
            Map<Long, Instant> afterLocks = MatchdayLock.lockTimes(edition, calendar, List.copyOf(wanted.values()));
            Set<Object> reopened = new HashSet<>();
            Set<Object> closedEarly = new HashSet<>();
            for (Match match : wanted.values()) {
                if (!before.contains(match)) continue;
                boolean closedBefore = startedOrClosed(match, beforeLocks.get(match.getId()), now);
                boolean closedAfter = startedOrClosed(match, afterLocks.get(match.getId()), now);
                if (closedBefore && !closedAfter && predictions.getOrDefault(match.getId(), 0) > 0) {
                    reopened.add(group.apply(match));
                }
                if (!closedBefore && closedAfter) closedEarly.add(group.apply(match));
            }
            for (Match match : calendar) {
                Object key = group.apply(match);
                boolean in = wanted.containsKey(match.getId());
                if (!in && before.contains(match) && reopened.contains(key)
                        && startedOrClosed(match, beforeLocks.get(match.getId()), now)) {
                    wanted.put(match.getId(), match);
                    kept++;
                    changed = true;
                } else if (in && !before.contains(match) && closedEarly.contains(key)
                        && startedOrClosed(match, ownLock(edition, match), now)) {
                    wanted.remove(match.getId());
                    changed = true;
                }
            }
        }
        if (mode == MatchSelectionMode.CUSTOM && wanted.isEmpty()) {
            throw BusinessException.badRequest("Elige al menos un equipo o un partido");
        }
        // Lo que sale de la liga con predicciones solo puede estar abierto: se borran, aún no daban puntos.
        Set<Long> removedWithPredictions = calendar.stream()
                .filter(match -> before.contains(match) && !wanted.containsKey(match.getId())
                        && predictions.getOrDefault(match.getId(), 0) > 0)
                .map(Match::getId)
                .collect(Collectors.toSet());

        persist(edition, MatchSelection.normalized(mode, requestedTeams, calendar, wanted.keySet()));

        int removedPredictions = 0;
        if (!removedWithPredictions.isEmpty()) {
            removedPredictions = matchPredictionRepository.deleteByEditionIdAndMatchIdIn(edition.getId(),
                    removedWithPredictions);
            scoreInvalidationService.invalidateEdition(edition.getId());
        }
        return view(edition, calendar, removedPredictions, kept);
    }

    private void persist(Edition edition, MatchSelection selection) {
        Long editionId = edition.getId();
        edition.setMatchSelection(selection.mode());
        editionRepository.save(edition);

        List<EditionFollowedTeam> currentTeams = followedTeamRepository.findByEditionId(editionId);
        followedTeamRepository.deleteAll(currentTeams.stream()
                .filter(team -> !selection.teamIds().contains(team.getId().getTeamId())).toList());
        Set<Long> existingTeams = currentTeams.stream().map(team -> team.getId().getTeamId()).collect(Collectors.toSet());
        followedTeamRepository.saveAll(selection.teamIds().stream()
                .filter(id -> !existingTeams.contains(id))
                .map(id -> new EditionFollowedTeam(new EditionFollowedTeam.Key(editionId, id)))
                .toList());

        Map<Long, Boolean> wanted = new HashMap<>();
        selection.included().forEach(id -> wanted.put(id, true));
        selection.excluded().forEach(id -> wanted.put(id, false));
        List<EditionMatchChoice> currentChoices = choiceRepository.findByEditionId(editionId);
        choiceRepository.deleteAll(currentChoices.stream()
                .filter(choice -> !wanted.containsKey(choice.getId().getMatchId())).toList());
        Map<Long, EditionMatchChoice> existing = currentChoices.stream()
                .collect(Collectors.toMap(choice -> choice.getId().getMatchId(), choice -> choice));
        for (Map.Entry<Long, Boolean> entry : wanted.entrySet()) {
            EditionMatchChoice choice = existing.get(entry.getKey());
            if (choice == null) {
                choiceRepository.save(new EditionMatchChoice(
                        new EditionMatchChoice.Key(editionId, entry.getKey()), entry.getValue()));
            } else if (choice.isIncluded() != entry.getValue()) {
                choice.setIncluded(entry.getValue());
            }
        }
        choiceRepository.flush();
        followedTeamRepository.flush();
    }

    private MatchSelectionDTO view(Edition edition, List<Match> calendar, int removedPredictions, int kept) {
        MatchSelection selection = of(edition);
        Map<Long, Integer> predictions = predictionCounts(edition);
        Map<Long, Instant> locks = MatchdayLock.lockTimes(edition, calendar, selection.filter(calendar));
        Instant now = Instant.now();
        List<MatchSelectionDTO.Item> items = sorted(calendar).stream()
                .map(match -> MatchSelectionDTO.Item.of(match, selection.contains(match),
                        startedOrClosed(match, locks.get(match.getId()), now),
                        predictions.getOrDefault(match.getId(), 0)))
                .toList();
        return new MatchSelectionDTO(selection.mode().name(), sortedIds(selection.teamIds()),
                sortedIds(selection.included()), sortedIds(selection.excluded()), teams(calendar), items,
                removedPredictions, kept);
    }

    /** Cierre del partido por sí solo, sin contar el resto de su día o su jornada. */
    private static Instant ownLock(Edition edition, Match match) {
        return match.getMatchDate() == null ? null
                : match.getMatchDate().minus(Math.max(0, edition.getLockOffsetMinutes()), ChronoUnit.MINUTES);
    }

    /** Ya no admite predicciones: terminado, empezado, suspendido o pasado su cierre. */
    static boolean startedOrClosed(Match match, Instant lockAt, Instant now) {
        if (Boolean.TRUE.equals(match.getFinished())) return true;
        if (match.getStatus() != null && !match.getStatus().isOpenForPrediction()) return true;
        if (match.getMatchDate() != null && !match.getMatchDate().isAfter(now)) return true;
        return lockAt != null && !lockAt.isAfter(now);
    }

    private Map<Long, Integer> predictionCounts(Edition edition) {
        Map<Long, Integer> counts = new HashMap<>();
        for (Object[] row : matchPredictionRepository.countByMatchForEdition(edition.getId())) {
            counts.put((Long) row[0], ((Number) row[1]).intValue());
        }
        return counts;
    }

    /** Equipos reales del calendario, por nombre. */
    private static List<MatchSelectionDTO.TeamItem> teams(List<Match> calendar) {
        Map<Long, Team> teams = new LinkedHashMap<>();
        for (Match match : calendar) {
            for (Team team : new Team[]{match.getHomeTeam(), match.getAwayTeam()}) {
                if (team != null && team.getId() != null && !Team.isPlaceholder(team)) {
                    teams.putIfAbsent(team.getId(), team);
                }
            }
        }
        return teams.values().stream()
                .sorted(Comparator.comparing(Team::getName, String.CASE_INSENSITIVE_ORDER))
                .map(MatchSelectionDTO.TeamItem::of)
                .toList();
    }

    /** Por fecha, sin los huecos del calendario que aún no tienen ningún equipo. */
    private static List<Match> sorted(List<Match> calendar) {
        return calendar.stream()
                .filter(match -> !(Team.isPlaceholder(match.getHomeTeam()) && Team.isPlaceholder(match.getAwayTeam())))
                .sorted(Comparator.comparing(Match::getMatchDate, Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(Match::getId))
                .toList();
    }

    private static List<Long> sortedIds(Set<Long> ids) {
        return ids.stream().filter(Objects::nonNull).sorted().toList();
    }

    private Edition adminEdition(Long leagueId, String email) {
        Edition edition = editionRepository.findByLeagueIdAndStatus(leagueId, "ACTIVE")
                .orElseThrow(() -> BusinessException.notFound("Liga no encontrada"));
        if (edition.getLeague().getAdminUser() == null || email == null
                || !email.equalsIgnoreCase(edition.getLeague().getAdminUser().getGoogleEmail())) {
            throw BusinessException.forbidden("Solo el administrador puede elegir los partidos");
        }
        requireSelectable(edition);
        return edition;
    }

    /** Solo las ligas por jornadas sobre una competición oficial eligen partidos. */
    private static void requireSelectable(Edition edition) {
        if (edition.getPoolFormat() != PoolFormat.MATCH_DAY) {
            throw BusinessException.badRequest("Solo las ligas por jornadas pueden elegir sus partidos");
        }
        if (edition.getCompetition() == null || edition.getCompetition().getOwnerLeague() != null) {
            throw BusinessException.badRequest("En una competición personalizada los partidos ya los creas tú");
        }
    }
}
