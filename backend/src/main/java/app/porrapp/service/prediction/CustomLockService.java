package app.porrapp.service.prediction;

import app.porrapp.dto.PredictionDataDTO;
import app.porrapp.exception.BusinessException;
import app.porrapp.model.Competition;
import app.porrapp.model.Edition;
import app.porrapp.model.Match;
import app.porrapp.model.PredictionLockMode;
import app.porrapp.model.PoolFormat;
import app.porrapp.repository.CompetitionTeamRepository;
import app.porrapp.repository.EditionRepository;
import app.porrapp.repository.MatchRepository;
import app.porrapp.repository.TeamRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.TreeSet;

/**
 * Qué partes de un pronóstico de cuadro (competición personalizada o torneo oficial con cuadro propio)
 * siguen abiertas. En los modos
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
    private final CompetitionTeamRepository competitionTeams;
    private final EditionRepository editions;
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
     * @param knockoutRounds en unas eliminatorias que se sortean ronda a ronda, sus rondas y cruces; null si no
     */
    public record LockState(PredictionLockMode mode, int offsetMinutes, Instant lockDate,
                            List<String> groups, List<List<Boolean>> picks, boolean anyLocked,
                            boolean fullyLocked, Instant nextLockAt, List<DrawnKnockout.Round> knockoutRounds) {
        public LockState(PredictionLockMode mode, int offsetMinutes, Instant lockDate, List<String> groups,
                         List<List<Boolean>> picks, boolean anyLocked, boolean fullyLocked, Instant nextLockAt) {
            this(mode, offsetMinutes, lockDate, groups, picks, anyLocked, fullyLocked, nextLockAt, null);
        }

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
        if (PoolFormat.isMatchBased(edition.getPoolFormat())) {
            // Por jornadas (y superviviente) cada partido se cierra por su cuenta: aquí solo interesa el criterio elegido.
            return new LockState(MatchdayLock.mode(edition), Math.max(0, edition.getLockOffsetMinutes()), null,
                    List.of(), List.of(), false, edition.isLocked(clock), null);
        }
        if (DrawnKnockout.applies(edition)) return drawnState(edition, all);
        PredictionLockMode mode = edition.getLockMode() == null ? PredictionLockMode.FIXED_DATE : edition.getLockMode();
        int offset = Math.max(0, edition.getLockOffsetMinutes());
        Instant now = clock.instant();

        Competition competition = edition.getCompetition();
        List<List<Match>> bracket = competition == null ? List.of() : PredictableBracket.rounds(competition, all);
        List<Match> firstRound = bracket.isEmpty() ? List.of() : bracket.get(0);
        int totalRounds = 0;
        for (int count = firstRound.size(); count > 0; count = count == 1 ? 0 : (count + 1) / 2) totalRounds++;
        TreeSet<String> groupNames = new TreeSet<>();
        if (edition.getPoolFormat() == PoolFormat.FULL_BRACKET && competition != null) {
            Map<Long, String> groupOf = competitionTeams.groupByTeamId(competition.getId());
            teams.findByCompetitionIdOrderByNameAsc(competition.getId()).stream()
                    .map(team -> groupOf.get(team.getId()))
                    .filter(name -> name != null && !name.isBlank())
                    .forEach(groupNames::add);
        }
        // Los grupos de un torneo oficial solo cuentan si se pronostican (cuadro completo).
        if (competition != null
                && (competition.getOwnerLeague() != null || edition.getPoolFormat() == PoolFormat.FULL_BRACKET)) {
            all.stream().filter(match -> "group".equals(match.getRound()) && match.getGroupName() != null)
                    .forEach(match -> groupNames.add(match.getGroupName()));
        }

        if (!mode.progressive()) {
            boolean locked = edition.isLocked(clock);
            List<List<Boolean>> picks = new ArrayList<>();
            for (int round = 0, count = firstRound.size(); round < totalRounds; round++, count = (count + 1) / 2) {
                picks.add(new ArrayList<>(java.util.Collections.nCopies(count, locked)));
            }
            return new LockState(mode, offset, edition.getLockDate(), locked ? List.copyOf(groupNames) : List.of(),
                    picks, locked, locked, locked ? null : edition.getLockDate());
        }

        List<Instant> upcoming = new ArrayList<>();
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
            List<Match> created = round == 0 ? firstRound : placed(competition, firstRound,
                    round < bracket.size() ? bracket.get(round) : List.of(), round, count);
            boolean roundLocked = mode == PredictionLockMode.PER_ROUND && anyStarted(created, offset, now, upcoming);
            List<Boolean> row = new ArrayList<>();
            for (int index = 0; index < count; index++) {
                // Quien pasa por descanso no se elige: no cuenta para el cierre.
                boolean forced = round == 0 ? firstRound.get(index).getAwayTeam() == null : index * 2 + 1 >= previous;
                boolean locked = !forced && (roundLocked || index < created.size() && created.get(index) != null
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
        Instant next = upcoming.stream().filter(Objects::nonNull).min(Comparator.naturalOrder()).orElse(null);
        return new LockState(mode, offset, null, lockedGroups, picks, anyLocked, fullyLocked,
                fullyLocked ? null : next);
    }

    /**
     * Eliminatorias sorteadas ronda a ronda: cada ronda se cierra al empezar su primer partido o, por
     * eliminatorias, cada cruce al empezar su ida (menos el margen). Lo que aún no se ha sorteado no se
     * cierra, y entrar tarde está permitido: solo se pierden las rondas ya cerradas.
     */
    private LockState drawnState(Edition edition, List<Match> all) {
        PredictionLockMode mode = edition.getLockMode() == PredictionLockMode.PER_MATCH
                ? PredictionLockMode.PER_MATCH : PredictionLockMode.PER_ROUND;
        int offset = Math.max(0, edition.getLockOffsetMinutes());
        Instant now = clock.instant();
        List<DrawnKnockout.Round> rounds = DrawnKnockout.rounds(edition, all);
        List<Instant> upcoming = new ArrayList<>();
        List<List<Boolean>> picks = new ArrayList<>();
        boolean anyLocked = false;
        for (DrawnKnockout.Round round : rounds) {
            List<Match> firstLegs = round.ties().stream().map(tie -> tie.legs().get(0)).toList();
            boolean drawn = round.drawn();
            boolean roundLocked = drawn && mode == PredictionLockMode.PER_ROUND
                    && anyStarted(firstLegs, offset, now, upcoming);
            List<Boolean> row = new ArrayList<>();
            for (Match firstLeg : firstLegs) {
                boolean locked = drawn && (roundLocked || mode == PredictionLockMode.PER_MATCH
                        && started(firstLeg, offset, now, upcoming));
                row.add(locked);
                anyLocked |= locked;
            }
            picks.add(row);
        }
        DrawnKnockout.Round last = rounds.isEmpty() ? null : rounds.get(rounds.size() - 1);
        boolean fullyLocked = last != null && "final".equals(last.key()) && last.drawn()
                && picks.get(picks.size() - 1).stream().allMatch(Boolean::booleanValue);
        Instant next = upcoming.stream().filter(Objects::nonNull).min(Comparator.naturalOrder()).orElse(null);
        return new LockState(mode, offset, null, List.of(), picks, anyLocked, fullyLocked,
                fullyLocked ? null : next, rounds);
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
                if (state.pickLocked(round, index) && !Objects.equals(pick(saved == null ? null
                        : saved.getCustomSeriesGames(), round, index), pick(incoming.getCustomSeriesGames(), round, index))) {
                    throw BusinessException.conflict("Esa serie ya ha empezado y no se puede cambiar");
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
        if (data.getCustomSeriesGames() != null) {
            List<List<Integer>> games = new ArrayList<>();
            for (int round = 0; round < data.getCustomSeriesGames().size(); round++) {
                List<Integer> row = data.getCustomSeriesGames().get(round);
                List<Integer> shown = new ArrayList<>();
                for (int index = 0; row != null && index < row.size(); index++) {
                    shown.add(state.pickLocked(round, index) ? row.get(index) : null);
                }
                games.add(shown);
            }
            copy.setCustomSeriesGames(games);
        }
        int last = rounds.size() - 1;
        copy.setChampion(last >= 0 && state.pickLocked(last, 0) ? data.getChampion() : null);
        return copy;
    }

    private static <T> T pick(List<List<T>> rounds, int round, int index) {
        return rounds != null && round < rounds.size() && rounds.get(round) != null && index < rounds.get(round).size()
                ? rounds.get(round).get(index) : null;
    }

    /**
     * Primer cruce de un cuadro oficial propio que no se sortea ronda a ronda (ver
     * {@link PredictableBracket#predictionsCloseAt}); null si no aplica o aún no hay cruces definidos.
     */
    public Instant bracketClosesAt(Edition edition) {
        Competition competition = edition.getCompetition();
        if (competition == null) return null;
        return PredictableBracket.predictionsCloseAt(competition, edition.getPoolFormat(),
                matches.findByCompetitionId(competition.getId()));
    }

    /** Fecha del primer cierre en el modo {@link PredictionLockMode#FIRST_MATCH}: el primer partido con fecha. */
    public Instant firstMatchLock(Edition edition) {
        if (edition.getCompetition() == null) return null;
        return firstMatchLock(edition, matches.findByCompetitionId(edition.getCompetition().getId()));
    }

    public Instant firstMatchLockWithoutMatch(Edition edition, Long matchId) {
        return firstMatchLock(edition, matches.findByCompetitionId(edition.getCompetition().getId()).stream()
                .filter(match -> !matchId.equals(match.getId())).toList());
    }

    private static Instant firstMatchLock(Edition edition, List<Match> all) {
        // En un torneo oficial con cuadro propio cuenta su primer cruce, no la fase previa.
        Competition competition = edition.getCompetition();
        if (competition != null && competition.getOwnerLeague() == null && PredictableBracket.applies(edition)) {
            List<List<Match>> bracket = PredictableBracket.rounds(competition, all);
            all = bracket.isEmpty() ? List.of() : bracket.get(0);
        }
        return all.stream()
                .filter(match -> match.getMatchDate() != null && match.getAwayTeam() != null)
                .map(Match::getMatchDate).min(Comparator.naturalOrder())
                .map(date -> date.minus(Math.max(0, edition.getLockOffsetMinutes()), ChronoUnit.MINUTES))
                .orElse(null);
    }

    /**
     * Tras sincronizar un calendario oficial, el cierre en el primer partido de sus ligas lo sigue.
     * Solo se mueve mientras sigue en el futuro: nunca vuelve a abrir pronósticos ya cerrados.
     */
    @Transactional
    public void refreshFirstMatchLocks(Long competitionId) {
        if (competitionId == null) return;
        List<Edition> active = editions.findByCompetitionIdAndStatus(competitionId, "ACTIVE");
        if (active == null || active.isEmpty()) return;
        Instant now = clock.instant();
        List<Match> all = matches.findByCompetitionId(competitionId);
        for (Edition edition : active) {
            if (edition.getLockMode() != PredictionLockMode.FIRST_MATCH) continue;
            if (edition.getLockDate() != null && !edition.getLockDate().isAfter(now)) continue;
            Instant lock = firstMatchLock(edition, all);
            if (lock != null && !lock.equals(edition.getLockDate())) {
                edition.setLockDate(lock);
                editions.save(edition);
            }
        }
    }

    /**
     * Cruces de una ronda posterior en el hueco del cuadro que les toca. En una competición personalizada
     * van en orden; en un torneo oficial, junto a los cruces de la primera ronda de los que salen sus equipos.
     */
    private static List<Match> placed(Competition competition, List<Match> firstRound, List<Match> created,
                                      int round, int count) {
        if (competition.getOwnerLeague() != null) return created;
        Map<String, Integer> origin = new HashMap<>();
        for (int index = 0; index < firstRound.size(); index++) {
            Match match = firstRound.get(index);
            if (match.getHomeTeam() != null) origin.put(match.getHomeTeam().getName(), index);
            if (match.getAwayTeam() != null) origin.put(match.getAwayTeam().getName(), index);
        }
        List<Match> slots = new ArrayList<>(java.util.Collections.nCopies(count, (Match) null));
        List<Match> unplaced = new ArrayList<>();
        for (Match match : created) {
            Integer from = match.getHomeTeam() == null ? null : origin.get(match.getHomeTeam().getName());
            if (from == null && match.getAwayTeam() != null) from = origin.get(match.getAwayTeam().getName());
            int slot = from == null ? -1 : from >> round;
            if (slot >= 0 && slot < count && slots.get(slot) == null) slots.set(slot, match);
            else unplaced.add(match);
        }
        for (Match match : unplaced) {
            int free = slots.indexOf(null);
            if (free < 0) break;
            slots.set(free, match);
        }
        return slots;
    }

    private static boolean anyStarted(List<Match> fixtures, int offset, Instant now, List<Instant> upcoming) {
        boolean locked = false;
        Instant first = null;
        for (Match match : fixtures) {
            if (match == null || match.getAwayTeam() == null) continue;
            locked |= started(match, offset, now, null);
            if (match.getMatchDate() != null) {
                Instant lock = match.getMatchDate().minus(offset, ChronoUnit.MINUTES);
                if (first == null || lock.isBefore(first)) first = lock;
            }
        }
        if (!locked && first != null) upcoming.add(first);
        return locked;
    }

    /** Un cruce con descanso no se juega; el resto se cierra al empezar, al jugarse o al llegar su hora. */
    private static boolean started(Match match, int offset, Instant now, List<Instant> upcoming) {
        if (match.getAwayTeam() == null) return false;
        if (Boolean.TRUE.equals(match.getFinished())
                || match.getStatus() != null && !match.getStatus().isOpenForPrediction()) {
            return true;
        }
        if (match.getMatchDate() == null) return false;
        Instant lock = match.getMatchDate().minus(offset, ChronoUnit.MINUTES);
        if (!now.isBefore(lock)) return true;
        if (upcoming != null) upcoming.add(lock);
        return false;
    }
}
