package com.porra.mundial.service.prediction;

import com.porra.mundial.dto.MatchSelectionDTO;
import com.porra.mundial.dto.MatchSelectionRequest;
import com.porra.mundial.exception.BusinessException;
import com.porra.mundial.model.Competition;
import com.porra.mundial.model.Edition;
import com.porra.mundial.model.EditionCompetition;
import com.porra.mundial.model.EditionFollowedTeam;
import com.porra.mundial.model.EditionMatchChoice;
import com.porra.mundial.model.EventSeries;
import com.porra.mundial.model.Match;
import com.porra.mundial.model.MatchSelectionMode;
import com.porra.mundial.model.PoolFormat;
import com.porra.mundial.model.Sport;
import com.porra.mundial.model.Team;
import com.porra.mundial.repository.CompetitionRepository;
import com.porra.mundial.repository.EditionCompetitionRepository;
import com.porra.mundial.repository.EditionFollowedTeamRepository;
import com.porra.mundial.repository.EditionMatchChoiceRepository;
import com.porra.mundial.repository.EditionRepository;
import com.porra.mundial.repository.MatchPredictionRepository;
import com.porra.mundial.repository.MatchRepository;
import com.porra.mundial.util.AppTime;
import com.porra.mundial.util.MatchRound;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.function.Predicate;
import java.util.stream.Collectors;

/**
 * Qué partidos entran en una liga por jornadas sobre competiciones oficiales: todos los de su
 * competición, o los de unos equipos (también los que ESPN cargue más tarde) más o menos los elegidos a
 * mano. Una liga puede juntar partidos sueltos de varias competiciones (un Clásico, un derbi de la
 * Premier, un partido de Champions); entonces sus jornadas son semanas de lunes a domingo, porque las
 * de cada competición no coinciden.
 *
 * <p>Cambiar la selección nunca cambia los puntos: un partido ya cerrado con predicciones no se puede
 * quitar (se queda en la liga, y su competición con él), y al quitar un partido aún abierto se borran
 * sus predicciones en esta liga, que todavía no daban puntos. Añadir un partido ya jugado no cambia
 * nada: nadie lo predijo. Los cierres por día o por jornada siguen el calendario de la liga; un cambio
 * que reabriría un partido con predicciones o cerraría antes de tiempo uno abierto conserva o descarta
 * el partido que lo causa.</p>
 */
@Service
@RequiredArgsConstructor
public class MatchSelectionService {
    /** Competiciones que puede juntar una liga, contando la suya. */
    public static final int MAX_COMPETITIONS = 8;

    private final EditionRepository editionRepository;
    private final CompetitionRepository competitionRepository;
    private final MatchRepository matchRepository;
    private final MatchPredictionRepository matchPredictionRepository;
    private final EditionFollowedTeamRepository followedTeamRepository;
    private final EditionMatchChoiceRepository choiceRepository;
    private final EditionCompetitionRepository editionCompetitionRepository;
    private final ScoreInvalidationService scoreInvalidationService;

    /** Si la liga elige sus partidos; si no, entran todos y no hace falta consultar nada. */
    public static boolean selects(Edition edition) {
        return edition != null && (edition.getMatchSelection() == MatchSelectionMode.CUSTOM || since(edition) != null);
    }

    /**
     * Una liga de la UFC con todas las veladas cubre las que acaban desde el día en que se creó: las
     * anteriores ya no se pueden predecir y solo llenarían el selector de veladas. Una velada entra o queda
     * fuera entera (ver {@link #roundsEndingFrom}). Null en el resto de ligas.
     */
    public static Instant since(Edition edition) {
        if (edition == null || edition.getMatchSelection() != MatchSelectionMode.ALL || edition.getCreatedAt() == null
                || edition.isMultiCompetition() || !Sport.isMma(edition.getCompetition())) {
            return null;
        }
        return AppTime.startOfDay(AppTime.day(edition.getCreatedAt()));
    }

    /**
     * Serie de veladas que sigue una liga de la UFC con todas las veladas: solo las numeradas o solo las
     * Fight Night. Null para todas, y en el resto de ligas.
     */
    public static EventSeries series(Edition edition) {
        return since(edition) == null ? null : edition.getEventSeries();
    }

    private static boolean onOrAfter(Match match, Instant since) {
        return since == null || (match.getMatchDate() != null && !match.getMatchDate().isBefore(since));
    }

    /**
     * Veladas (rondas) cuya última pelea empieza desde {@code since}. Se mira la velada entera y no cada
     * pelea: una velada que cruza la medianoche no se parte en preliminares fuera y cartelera estelar dentro.
     */
    private Set<String> roundsEndingFrom(Edition edition, Collection<String> rounds, Instant since) {
        if (rounds.isEmpty() || edition.getCompetition() == null) return Set.of();
        Set<String> result = new HashSet<>();
        for (Object[] row : matchRepository.lastMatchDateByRound(edition.getCompetition().getId(), rounds)) {
            if (row[1] instanceof Instant last && !last.isBefore(since)) result.add((String) row[0]);
        }
        return result;
    }

    /** Si el partido cae en las veladas que cubre la liga (siempre, salvo en las de la UFC). */
    private boolean inWindow(Edition edition, Match match) {
        Instant since = since(edition);
        if (since == null) return true;
        EventSeries series = series(edition);
        if (match.getRound() == null) return series == null && onOrAfter(match, since);
        return EventSeries.includes(series, match.getRound())
                && roundsEndingFrom(edition, List.of(match.getRound()), since).contains(match.getRound());
    }

    /**
     * Competiciones de la liga sin pasar por el servicio en las de una sola competición (casi todas).
     * Estático para no consultar nada en ellas.
     */
    public static List<Long> competitionIds(MatchSelectionService service, Edition edition) {
        if (edition == null || edition.getCompetition() == null) return List.of();
        return edition.isMultiCompetition() ? service.competitionIds(edition)
                : List.of(edition.getCompetition().getId());
    }

    /**
     * Calendario de la liga ({@link #leagueCalendar(Edition, Function)}) sin pasar por el servicio en las
     * ligas de una competición con todos sus partidos: el de la competición tal cual.
     */
    public static List<Match> leagueCalendar(MatchSelectionService service, Edition edition,
                                             Function<Long, List<Match>> byCompetition) {
        if (edition == null || edition.getCompetition() == null) return List.of();
        if (!edition.isMultiCompetition() && !selects(edition)) {
            return byCompetition.apply(edition.getCompetition().getId());
        }
        return service.leagueCalendar(edition, byCompetition);
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
        List<Match> selected = of(edition).filter(matches);
        Instant since = since(edition);
        if (since == null) return selected;
        EventSeries series = series(edition);
        Set<String> rounds = roundsEndingFrom(edition, selected.stream().map(Match::getRound)
                .filter(round -> round != null && EventSeries.includes(series, round))
                .collect(Collectors.toSet()), since);
        return selected.stream()
                .filter(m -> m.getRound() != null ? rounds.contains(m.getRound()) : series == null && onOrAfter(m, since))
                .toList();
    }

    /**
     * Competiciones de las que la liga toma partidos, la principal primero. Sin consultas salvo en las
     * ligas que juntan varias.
     */
    @Transactional(readOnly = true)
    public List<Long> competitionIds(Edition edition) {
        if (edition == null || edition.getCompetition() == null) return List.of();
        Long primary = edition.getCompetition().getId();
        if (!edition.isMultiCompetition() || edition.getId() == null) return List.of(primary);
        List<Long> ids = new ArrayList<>(List.of(primary));
        editionCompetitionRepository.findCompetitionIds(edition.getId()).stream()
                .filter(id -> !Objects.equals(id, primary))
                .sorted()
                .forEach(ids::add);
        return ids;
    }

    /** Si el partido es de una de las competiciones de la liga (entre o no en su selección). */
    @Transactional(readOnly = true)
    public boolean coversCompetition(Edition edition, Match match) {
        if (match == null || match.getCompetition() == null || edition == null || edition.getCompetition() == null) {
            return false;
        }
        Long competitionId = match.getCompetition().getId();
        return Objects.equals(edition.getCompetition().getId(), competitionId)
                || (edition.isMultiCompetition() && competitionIds(edition).contains(competitionId));
    }

    /** Todos los partidos de las competiciones de la liga, entren o no en ella. */
    @Transactional(readOnly = true)
    public List<Match> sourceCalendar(Edition edition) {
        return sourceCalendar(edition, matchRepository::findByCompetitionId);
    }

    /**
     * Lo mismo, cargando cada competición con {@code byCompetition} (quien recorre muchas ligas puede
     * cargar cada calendario una sola vez).
     */
    @Transactional(readOnly = true)
    public List<Match> sourceCalendar(Edition edition, Function<Long, List<Match>> byCompetition) {
        List<Long> ids = competitionIds(edition);
        if (ids.isEmpty()) return List.of();
        if (ids.size() == 1) return byCompetition.apply(ids.get(0));
        List<Match> calendar = new ArrayList<>();
        ids.forEach(id -> calendar.addAll(byCompetition.apply(id)));
        return calendar;
    }

    /**
     * Calendario de la liga: los partidos de sus competiciones que entran en ella. Es el que cuenta para
     * las jornadas y los cierres por día o por jornada. Sin consultas de selección si entran todos.
     */
    @Transactional(readOnly = true)
    public List<Match> leagueCalendar(Edition edition) {
        return leagueCalendar(edition, matchRepository::findByCompetitionId);
    }

    @Transactional(readOnly = true)
    public List<Match> leagueCalendar(Edition edition, Function<Long, List<Match>> byCompetition) {
        List<Match> source = sourceCalendar(edition, byCompetition);
        return selects(edition) ? filter(edition, source) : source;
    }

    /** Si un partido entra en la liga. */
    @Transactional(readOnly = true)
    public boolean contains(Edition edition, Match match) {
        return coversCompetition(edition, match) && of(edition).contains(match) && inWindow(edition, match);
    }

    /** Calendario de una competición oficial para elegir partidos al crear una liga: entran todos. */
    @Transactional(readOnly = true)
    public MatchSelectionDTO competitionCalendar(Long competitionId) {
        return competitionCalendar(List.of(competitionId));
    }

    /**
     * Calendario de una o varias competiciones oficiales (la principal primero) para elegir partidos al
     * crear una liga. Con varias, las jornadas son semanas, como en la liga que se creará.
     */
    @Transactional(readOnly = true)
    public MatchSelectionDTO competitionCalendar(List<Long> competitionIds) {
        List<Long> ids = competitionIds == null ? List.of()
                : competitionIds.stream().filter(Objects::nonNull).distinct().toList();
        if (ids.isEmpty()) throw BusinessException.badRequest("Elige una competición");
        List<Competition> competitions = officialCompetitions(ids);
        boolean multi = ids.size() > 1;
        List<Match> calendar = new ArrayList<>();
        ids.forEach(id -> calendar.addAll(matchRepository.findByCompetitionId(id)));
        Instant now = Instant.now();
        List<MatchSelectionDTO.Item> items = sorted(calendar).stream()
                .map(match -> MatchSelectionDTO.Item.of(match,
                        multi ? MatchRound.multiCompetitionLabel(match) : MatchRound.label(match), true,
                        startedOrClosed(match, null, now), 0))
                .toList();
        return new MatchSelectionDTO(MatchSelectionMode.ALL.name(), List.of(), List.of(), List.of(),
                teams(calendar), items, 0, 0, ids,
                competitions.stream().map(item -> MatchSelectionDTO.CompetitionItem.of(item, false)).toList());
    }

    /** Selección de la liga para su administrador. */
    @Transactional(readOnly = true)
    public MatchSelectionDTO view(Long leagueId, String email) {
        Edition edition = adminEdition(leagueId, email);
        return view(edition, sourceCalendar(edition), 0, 0);
    }

    @Transactional
    @CacheEvict(value = {"userGroups", "groupById", "groupByCode"}, allEntries = true)
    public MatchSelectionDTO update(Long leagueId, String email, MatchSelectionRequest request) {
        Edition edition = adminEdition(leagueId, email);
        if (edition.isLocked()) throw BusinessException.conflict("La liga ya está cerrada");
        return apply(edition, request);
    }

    /**
     * Guarda la selección de una edición ya comprobada (también al crear la liga). Valida que las
     * competiciones sean oficiales y del mismo deporte, que los equipos y partidos sean de ellas, y
     * protege los partidos cerrados con predicciones.
     */
    @Transactional
    public MatchSelectionDTO apply(Edition edition, MatchSelectionRequest request) {
        requireSelectable(edition);
        List<Long> beforeCompetitions = competitionIds(edition);
        List<Long> requestedCompetitions = requestedCompetitions(edition, request, beforeCompetitions);
        List<Competition> competitions = officialCompetitions(requestedCompetitions);
        boolean multi = requestedCompetitions.size() > 1;
        MatchSelectionMode mode = request.mode();
        // Los dos cuadros de un torneo de tenis se juntan enteros; el resto, eligiendo equipos o partidos.
        if (multi && mode != MatchSelectionMode.CUSTOM
                && Sport.ofExternalId(competitions.get(0).getExternalId()) != Sport.TENNIS) {
            throw BusinessException.badRequest("Para juntar varias competiciones elige los equipos o los partidos");
        }

        // Calendario de las competiciones de antes y de después: lo que sale y lo que entra.
        Set<Long> beforeSet = Set.copyOf(beforeCompetitions);
        Set<Long> requestedSet = Set.copyOf(requestedCompetitions);
        Set<Long> allCompetitions = new LinkedHashSet<>(beforeCompetitions);
        allCompetitions.addAll(requestedCompetitions);
        List<Match> calendar = new ArrayList<>();
        allCompetitions.forEach(id -> calendar.addAll(matchRepository.findByCompetitionId(id)));
        List<Match> requestedCalendar = calendar.stream().filter(match -> in(match, requestedSet)).toList();
        Set<Long> matchIds = requestedCalendar.stream().map(Match::getId).collect(Collectors.toSet());
        Set<Long> teamIds = teams(requestedCalendar).stream().map(MatchSelectionDTO.TeamItem::id)
                .collect(Collectors.toSet());

        Set<Long> requestedTeams = new HashSet<>(request.teamIdsOrEmpty());
        if (!teamIds.containsAll(requestedTeams)) {
            throw BusinessException.badRequest("Algún equipo no juega en las competiciones de la liga");
        }
        Set<Long> requestedMatches = new HashSet<>(request.includedOrEmpty());
        requestedMatches.addAll(request.excludedOrEmpty());
        if (!matchIds.containsAll(requestedMatches)) {
            throw BusinessException.badRequest("Algún partido no es de las competiciones de la liga");
        }
        MatchSelection requestedSelection = new MatchSelection(mode, requestedTeams,
                new HashSet<>(request.includedOrEmpty()), new HashSet<>(request.excludedOrEmpty()));
        Predicate<Match> requested = match -> in(match, requestedSet) && requestedSelection.contains(match);

        MatchSelection beforeSelection = of(edition);
        Predicate<Match> before = match -> in(match, beforeSet) && beforeSelection.contains(match);
        Map<Long, Integer> predictions = predictionCounts(edition);
        Instant now = Instant.now();
        // Cierre de cada partido con la selección actual (la jornada o el día son los de la liga).
        Map<Long, Instant> beforeLocks = MatchdayLock.lockTimes(edition, calendar,
                calendar.stream().filter(before).toList());
        // Desde aquí, la jornada es la de la liga tal como queda (por semanas si junta varias competiciones).
        edition.setMultiCompetition(multi);
        Function<Match, Object> group = MatchdayLock.groupKey(edition);

        Map<Long, Match> wanted = new LinkedHashMap<>();
        int kept = 0;
        for (Match match : calendar) {
            boolean in = requested.test(match);
            if (!in && before.test(match) && predictions.getOrDefault(match.getId(), 0) > 0
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
                if (!before.test(match)) continue;
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
                if (!in && before.test(match) && reopened.contains(key)
                        && startedOrClosed(match, beforeLocks.get(match.getId()), now)) {
                    wanted.put(match.getId(), match);
                    kept++;
                    changed = true;
                } else if (in && !before.test(match) && closedEarly.contains(key)
                        && startedOrClosed(match, ownLock(edition, match), now)) {
                    wanted.remove(match.getId());
                    changed = true;
                }
            }
        }
        // Una competición con partidos que se quedan en la liga no se puede quitar.
        for (Match match : wanted.values()) {
            if (!in(match, requestedSet)) {
                throw BusinessException.conflict("No puedes quitar " + match.getCompetition().getName()
                        + ": tiene partidos cerrados con predicciones");
            }
        }
        if (mode == MatchSelectionMode.CUSTOM && wanted.isEmpty()) {
            throw BusinessException.badRequest("Elige al menos un equipo o un partido");
        }
        // Lo que sale de la liga con predicciones solo puede estar abierto: se borran, aún no daban puntos.
        Set<Long> removedWithPredictions = calendar.stream()
                .filter(match -> before.test(match) && !wanted.containsKey(match.getId())
                        && predictions.getOrDefault(match.getId(), 0) > 0)
                .map(Match::getId)
                .collect(Collectors.toSet());

        // UFC con todas las veladas: la serie pedida, o la que ya tenía; con otra selección no aplica.
        boolean followsSeries = mode == MatchSelectionMode.ALL && !multi && Sport.isMma(edition.getCompetition());
        edition.setEventSeries(!followsSeries ? null
                : request.eventSeries() != null ? request.eventSeries() : edition.getEventSeries());
        persistCompetitions(edition, multi ? competitions : List.of());
        persist(edition, MatchSelection.normalized(mode, requestedTeams, requestedCalendar, wanted.keySet()));

        int removedPredictions = 0;
        if (!removedWithPredictions.isEmpty()) {
            removedPredictions = matchPredictionRepository.deleteByEditionIdAndMatchIdIn(edition.getId(),
                    removedWithPredictions);
            scoreInvalidationService.invalidateEdition(edition.getId());
        } else {
            // Las jornadas de la liga pueden haber cambiado (por semanas o por competición).
            scoreInvalidationService.evictLeaderboardAfterCommit(edition.getLeague().getId());
        }
        return view(edition, requestedCalendar, removedPredictions, kept);
    }

    /** Competiciones pedidas, con la principal siempre la primera; sin pedir ninguna, las de ahora. */
    private static List<Long> requestedCompetitions(Edition edition, MatchSelectionRequest request,
                                                    List<Long> current) {
        if (request.competitionIdsOrEmpty().isEmpty()) return current;
        Long primary = edition.getCompetition().getId();
        List<Long> ids = new ArrayList<>(List.of(primary));
        request.competitionIdsOrEmpty().stream()
                .filter(id -> id != null && !Objects.equals(id, primary))
                .distinct()
                .forEach(ids::add);
        return ids;
    }

    /** Competiciones oficiales del mismo deporte que la primera, en el orden pedido. */
    private List<Competition> officialCompetitions(List<Long> ids) {
        if (ids.size() > MAX_COMPETITIONS) {
            throw BusinessException.badRequest("Como mucho " + MAX_COMPETITIONS + " competiciones");
        }
        Map<Long, Competition> found = competitionRepository.findAllById(ids).stream()
                .filter(item -> item.getOwnerLeague() == null)
                .collect(Collectors.toMap(Competition::getId, item -> item));
        List<Competition> competitions = new ArrayList<>();
        for (Long id : ids) {
            Competition competition = found.get(id);
            if (competition == null) throw BusinessException.notFound("Competición no encontrada");
            competitions.add(competition);
        }
        Sport sport = Sport.ofExternalId(competitions.get(0).getExternalId());
        if (competitions.stream().anyMatch(item -> Sport.ofExternalId(item.getExternalId()) != sport)) {
            throw BusinessException.badRequest("Las competiciones de una liga tienen que ser del mismo deporte");
        }
        return competitions;
    }

    private static boolean in(Match match, Set<Long> competitionIds) {
        return match.getCompetition() != null && competitionIds.contains(match.getCompetition().getId());
    }

    /** Competiciones de una liga que junta varias; ninguna en una de una sola competición. */
    private void persistCompetitions(Edition edition, List<Competition> competitions) {
        Long editionId = edition.getId();
        Set<Long> wanted = competitions.stream().map(Competition::getId).collect(Collectors.toSet());
        List<EditionCompetition> current = editionCompetitionRepository.findByEditionId(editionId);
        editionCompetitionRepository.deleteAll(current.stream()
                .filter(item -> !wanted.contains(item.getId().getCompetitionId())).toList());
        Set<Long> existing = current.stream().map(item -> item.getId().getCompetitionId())
                .collect(Collectors.toSet());
        editionCompetitionRepository.saveAll(wanted.stream()
                .filter(id -> !existing.contains(id))
                .map(id -> new EditionCompetition(new EditionCompetition.Key(editionId, id)))
                .toList());
        editionCompetitionRepository.flush();
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
                .map(match -> MatchSelectionDTO.Item.of(match, MatchRound.label(edition, match),
                        selection.contains(match), startedOrClosed(match, locks.get(match.getId()), now),
                        predictions.getOrDefault(match.getId(), 0)))
                .toList();
        // Una competición con partidos cerrados y con predicciones ya no se puede quitar.
        Set<Long> lockedCompetitions = items.stream()
                .filter(item -> item.selected() && item.locked())
                .map(MatchSelectionDTO.Item::competitionId)
                .collect(Collectors.toSet());
        List<Long> competitionIds = competitionIds(edition);
        Map<Long, Competition> byId = competitionRepository.findAllById(competitionIds).stream()
                .collect(Collectors.toMap(Competition::getId, item -> item));
        List<MatchSelectionDTO.CompetitionItem> competitions = competitionIds.stream()
                .map(byId::get)
                .filter(Objects::nonNull)
                .map(item -> MatchSelectionDTO.CompetitionItem.of(item, lockedCompetitions.contains(item.getId())))
                .toList();
        return new MatchSelectionDTO(selection.mode().name(), sortedIds(selection.teamIds()),
                sortedIds(selection.included()), sortedIds(selection.excluded()), teams(calendar), items,
                removedPredictions, kept, competitionIds, competitions);
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

    /** Equipos reales del calendario, por nombre (un mismo club, una vez aunque juegue varias competiciones). */
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
