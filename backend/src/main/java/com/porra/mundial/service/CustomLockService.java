package com.porra.mundial.service;

import com.porra.mundial.dto.PredictionDataDTO;
import com.porra.mundial.exception.BusinessException;
import com.porra.mundial.model.Edition;
import com.porra.mundial.model.Match;
import com.porra.mundial.model.PredictionLockMode;
import com.porra.mundial.model.PoolFormat;
import com.porra.mundial.repository.MatchRepository;
import com.porra.mundial.repository.TeamRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.TreeSet;

/**
 * Qué partes de un pronóstico de competición personalizada siguen abiertas. En los modos
 * {@link PredictionLockMode#PER_ROUND} y {@link PredictionLockMode#PER_MATCH} el cierre llega por
 * partes: un grupo se cierra al empezar su primer partido y cada ganador del cuadro, al empezar su
 * cruce (o el primero de su ronda), siempre restando el margen configurado.
 */
@Service
@RequiredArgsConstructor
public class CustomLockService {
    static final ZoneId ZONE = ZoneId.of("Europe/Madrid");

    private final MatchRepository matches;
    private final TeamRepository teams;
    private Clock clock = Clock.system(ZONE);

    /** Solo para tests. */
    void setClock(Clock clock) {
        this.clock = clock;
    }

    /**
     * @param groups       grupos ya cerrados
     * @param picks        por ronda del cuadro, qué ganadores están cerrados (índice = cruce)
     * @param anyLocked    ya se ha cerrado algo: no se admiten pronósticos nuevos
     * @param fullyLocked  todo cerrado: el pronóstico ya no se puede cambiar
     * @param nextLockAt   próximo cierre conocido, o null
     */
    public record LockState(PredictionLockMode mode, int offsetMinutes, LocalDateTime lockDate,
                            List<String> groups, List<List<Boolean>> picks, boolean anyLocked,
                            boolean fullyLocked, LocalDateTime nextLockAt) {
        public boolean groupLocked(String group) {
            return groups.contains(group);
        }

        public boolean pickLocked(int round, int index) {
            return round < picks.size() && index < picks.get(round).size() && picks.get(round).get(index);
        }
    }

    public LockState state(Edition edition) {
        List<Match> all = edition.getCompetition() == null ? List.of()
                : matches.findByCompetitionId(edition.getCompetition().getId());
        return state(edition, all);
    }

    /** Calcula el cierre que quedaría al quitar un partido, antes de modificar la base de datos. */
    public LockState stateWithoutMatch(Edition edition, Long matchId) {
        List<Match> remaining = matches.findByCompetitionId(edition.getCompetition().getId()).stream()
                .filter(match -> !matchId.equals(match.getId())).toList();
        return state(edition, remaining);
    }

    private LockState state(Edition edition, List<Match> all) {
        PredictionLockMode mode = edition.getLockMode() == null ? PredictionLockMode.FIXED_DATE : edition.getLockMode();
        int offset = Math.max(0, edition.getLockOffsetMinutes());
        LocalDateTime now = LocalDateTime.now(clock.withZone(ZONE));

        List<Match> firstRound = round(all, 1);
        int totalRounds = 0;
        for (int count = firstRound.size(); count > 0; count = count == 1 ? 0 : (count + 1) / 2) totalRounds++;
        TreeSet<String> groupNames = new TreeSet<>();
        if (edition.getPoolFormat() == PoolFormat.FULL_BRACKET && edition.getCompetition() != null) {
            teams.findByCompetitionIdOrderByNameAsc(edition.getCompetition().getId()).stream()
                    .map(team -> team.getGroupName())
                    .filter(name -> name != null && !name.isBlank())
                    .forEach(groupNames::add);
        }
        all.stream().filter(match -> "group".equals(match.getRound()) && match.getGroupName() != null)
                .forEach(match -> groupNames.add(match.getGroupName()));

        if (!mode.progressive()) {
            boolean locked = edition.isLocked(clock);
            List<List<Boolean>> picks = new ArrayList<>();
            for (int round = 0, count = firstRound.size(); round < totalRounds; round++, count = (count + 1) / 2) {
                picks.add(new ArrayList<>(java.util.Collections.nCopies(count, locked)));
            }
            return new LockState(mode, offset, edition.getLockDate(), locked ? List.copyOf(groupNames) : List.of(),
                    picks, locked, locked, locked ? null : edition.getLockDate());
        }

        List<LocalDateTime> upcoming = new ArrayList<>();
        Map<String, Boolean> groupLocks = new HashMap<>();
        for (String group : groupNames) {
            List<Match> fixtures = all.stream()
                    .filter(match -> "group".equals(match.getRound()) && group.equals(match.getGroupName())).toList();
            groupLocks.put(group, anyStarted(fixtures, offset, now, upcoming));
        }

        List<List<Boolean>> picks = new ArrayList<>();
        boolean allPicks = totalRounds > 0;
        int previous = 0;
        for (int round = 0, count = firstRound.size(); round < totalRounds; round++, previous = count, count = (count + 1) / 2) {
            List<Match> created = round(all, round + 1);
            boolean roundLocked = mode == PredictionLockMode.PER_ROUND && anyStarted(created, offset, now, upcoming);
            List<Boolean> row = new ArrayList<>();
            for (int index = 0; index < count; index++) {
                // Quien pasa por descanso no se elige: no cuenta para el cierre.
                boolean forced = round == 0 ? firstRound.get(index).getAwayTeam() == null : index * 2 + 1 >= previous;
                boolean locked = !forced && (roundLocked || index < created.size()
                        && started(created.get(index), offset, now, mode == PredictionLockMode.PER_MATCH ? upcoming : null));
                row.add(locked);
                allPicks &= forced || locked;
            }
            picks.add(row);
        }
        List<String> lockedGroups = groupLocks.entrySet().stream().filter(Map.Entry::getValue)
                .map(Map.Entry::getKey).sorted().toList();
        boolean anyLocked = !lockedGroups.isEmpty() || picks.stream().flatMap(List::stream).anyMatch(Boolean::booleanValue);
        boolean fullyLocked = allPicks && lockedGroups.size() == groupNames.size();
        LocalDateTime next = upcoming.stream().filter(Objects::nonNull).min(Comparator.naturalOrder()).orElse(null);
        return new LockState(mode, offset, null, lockedGroups, picks, anyLocked, fullyLocked,
                fullyLocked ? null : next);
    }

    /** Lo ya cerrado no se puede cambiar: grupos cerrados y ganadores cerrados deben coincidir con lo guardado. */
    public void requireLockedPartsUnchanged(LockState state, PredictionDataDTO saved, PredictionDataDTO incoming) {
        Map<String, List<String>> before = saved == null || saved.getGroups() == null ? Map.of() : saved.getGroups();
        Map<String, List<String>> after = incoming.getGroups() == null ? Map.of() : incoming.getGroups();
        for (String group : state.groups()) {
            if (!Objects.equals(before.get(group), after.get(group))) {
                throw BusinessException.conflict("El grupo " + group + " ya ha empezado y no se puede cambiar");
            }
        }
        List<List<String>> old = saved == null || saved.getCustomRounds() == null ? List.of() : saved.getCustomRounds();
        List<List<String>> now = incoming.getCustomRounds() == null ? List.of() : incoming.getCustomRounds();
        for (int round = 0; round < state.picks().size(); round++) {
            for (int index = 0; index < state.picks().get(round).size(); index++) {
                if (state.pickLocked(round, index) && !Objects.equals(pick(old, round, index), pick(now, round, index))) {
                    throw BusinessException.conflict("Ese cruce ya ha empezado y no se puede cambiar");
                }
            }
        }
    }

    /**
     * Copia del pronóstico de otro participante con solo lo ya cerrado: lo que sigue abierto se oculta para
     * que nadie pueda copiarlo mientras aún se puede cambiar.
     */
    public PredictionDataDTO lockedPartsOnly(LockState state, PredictionDataDTO data) {
        PredictionDataDTO copy = new PredictionDataDTO();
        copy.setUser(data.getUser());
        copy.setPrediction(data.getPrediction());
        copy.setR16(List.of());
        if (data.getGroups() != null) {
            Map<String, List<String>> groups = new java.util.LinkedHashMap<>();
            data.getGroups().forEach((group, order) -> {
                if (state.groupLocked(group)) groups.put(group, order);
            });
            copy.setGroups(groups);
        }
        List<List<String>> rounds = data.getCustomRounds() == null ? List.of() : data.getCustomRounds();
        List<List<String>> visible = new ArrayList<>();
        for (int round = 0; round < rounds.size(); round++) {
            List<String> row = new ArrayList<>();
            for (int index = 0; index < rounds.get(round).size(); index++) {
                row.add(state.pickLocked(round, index) ? rounds.get(round).get(index) : null);
            }
            visible.add(row);
        }
        copy.setCustomRounds(visible);
        int last = rounds.size() - 1;
        copy.setChampion(last >= 0 && state.pickLocked(last, 0) ? data.getChampion() : null);
        return copy;
    }

    private static String pick(List<List<String>> rounds, int round, int index) {
        return round < rounds.size() && rounds.get(round) != null && index < rounds.get(round).size()
                ? rounds.get(round).get(index) : null;
    }

    /** Fecha del primer cierre en el modo {@link PredictionLockMode#FIRST_MATCH}: el primer partido con fecha. */
    public LocalDateTime firstMatchLock(Edition edition) {
        if (edition.getCompetition() == null) return null;
        return firstMatchLock(edition, matches.findByCompetitionId(edition.getCompetition().getId()));
    }

    public LocalDateTime firstMatchLockWithoutMatch(Edition edition, Long matchId) {
        return firstMatchLock(edition, matches.findByCompetitionId(edition.getCompetition().getId()).stream()
                .filter(match -> !matchId.equals(match.getId())).toList());
    }

    private static LocalDateTime firstMatchLock(Edition edition, List<Match> all) {
        return all.stream()
                .filter(match -> match.getMatchDate() != null && match.getAwayTeam() != null)
                .map(Match::getMatchDate).min(Comparator.naturalOrder())
                .map(date -> date.minusMinutes(Math.max(0, edition.getLockOffsetMinutes())))
                .orElse(null);
    }

    private static List<Match> round(List<Match> all, int round) {
        String name = "bracket-" + round;
        return all.stream().filter(match -> name.equals(match.getRound()))
                .sorted(Comparator.comparing(Match::getId)).toList();
    }

    private static boolean anyStarted(List<Match> fixtures, int offset, LocalDateTime now, List<LocalDateTime> upcoming) {
        boolean locked = false;
        LocalDateTime first = null;
        for (Match match : fixtures) {
            if (match.getAwayTeam() == null) continue;
            locked |= started(match, offset, now, null);
            if (match.getMatchDate() != null) {
                LocalDateTime lock = match.getMatchDate().minusMinutes(offset);
                if (first == null || lock.isBefore(first)) first = lock;
            }
        }
        if (!locked && first != null) upcoming.add(first);
        return locked;
    }

    /** Un cruce con descanso no se juega; el resto se cierra al empezar, al jugarse o al llegar su hora. */
    private static boolean started(Match match, int offset, LocalDateTime now, List<LocalDateTime> upcoming) {
        if (match.getAwayTeam() == null) return false;
        if (Boolean.TRUE.equals(match.getFinished())
                || match.getStatus() != null && !match.getStatus().isOpenForPrediction()) {
            return true;
        }
        if (match.getMatchDate() == null) return false;
        LocalDateTime lock = match.getMatchDate().minusMinutes(offset);
        if (!now.isBefore(lock)) return true;
        if (upcoming != null) upcoming.add(lock);
        return false;
    }
}
