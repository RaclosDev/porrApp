package app.porrapp.service.league;

import app.porrapp.model.Competition;
import app.porrapp.model.Edition;
import app.porrapp.model.KnockoutRound;
import app.porrapp.model.Match;
import app.porrapp.model.MatchStatusNormalized;
import app.porrapp.repository.MatchRepository;
import app.porrapp.service.prediction.MatchSelectionService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Si una liga ya ha terminado: se ha jugado todo lo que cuenta para ella y no queda nada por llegar.
 * Vale para cualquier deporte, porque solo mira el calendario de la liga (sus competiciones y, si elige
 * partidos, los elegidos). Lo dice en cuanto se juega el último partido, sin esperar a que el proveedor abra
 * la temporada siguiente y se archive la jugada ({@link LeagueSeasons#ended}), que también la da por terminada.
 */
@Service
@RequiredArgsConstructor
public class LeagueClosure {

    /**
     * Margen tras el último partido cuando el calendario no dice por sí solo que ha acabado: el proveedor
     * publica la ronda o la velada siguiente bastante antes.
     */
    static final Duration SETTLED_AFTER = Duration.ofDays(7);

    private static final Pattern CUSTOM_ROUND = Pattern.compile("bracket-([1-9][0-9]?)");

    private final MatchRepository matchRepository;
    private final MatchSelectionService matchSelectionService;
    private final LeagueSeasons leagueSeasons;

    @Transactional(readOnly = true)
    public boolean isFinished(Edition edition, Instant now) {
        if (edition == null || edition.getCompetition() == null) return false;
        if (leagueSeasons.ended(edition)) return true;
        // Tenis de varios torneos: entre uno y otro no queda nada pendiente y la liga sigue. Acaba con su
        // temporada, cuando se archivan sus torneos.
        if (edition.getTennisScope() != null) return false;
        // Lo habitual es una liga en juego: se descarta con una consulta, sin cargar su calendario. Si elige
        // partidos, los suyos pueden haber acabado aunque la competición siga.
        if (!MatchSelectionService.selects(edition) && matchRepository.existsOpenInCompetitions(
                MatchSelectionService.competitionIds(matchSelectionService, edition))) {
            return false;
        }
        List<Match> calendar = MatchSelectionService.leagueCalendar(matchSelectionService, edition,
                matchRepository::findByCompetitionId);
        return isFinished(edition, calendar, now);
    }

    /**
     * Terminada si todos sus partidos se han jugado (o se cancelaron), alguno se jugó con la liga ya creada
     * y no va a llegar ninguno más: el último es una final, el calendario se conoce entero desde el
     * principio o ha pasado {@link #SETTLED_AFTER} desde el último.
     */
    static boolean isFinished(Edition edition, List<Match> calendar, Instant now) {
        if (calendar.isEmpty() || !calendar.stream().allMatch(LeagueClosure::closed)) return false;
        Competition competition = edition.getCompetition();
        boolean own = competition.getOwnerLeague() != null;
        if (own && customFinalPlayed(calendar)) return true;
        Match last = calendar.stream()
                .filter(match -> match.getMatchDate() != null && Boolean.TRUE.equals(match.getFinished()))
                .max(Comparator.comparing(Match::getMatchDate))
                .orElse(null);
        if (last == null) return false;
        // Una liga creada con la temporada ya jugada espera a la siguiente (los playoffs de la NBA del año que viene).
        Instant created = edition.getCreatedAt();
        if (!own && created != null && !last.getMatchDate().isAfter(created)) return false;
        // En la UFC «final» solo puede ser parte del nombre de una velada.
        if (KnockoutRound.fromLabel(last.getRound()) == KnockoutRound.FINAL
                && !Competition.EVENTS_FORMAT.equals(competition.getFormatType())) {
            return true;
        }
        boolean fixedCalendar = calendar.stream().map(Match::getCompetition).filter(Objects::nonNull).distinct()
                .allMatch(LeagueClosure::hasFixedCalendar);
        return fixedCalendar || last.getMatchDate().isBefore(now.minus(SETTLED_AFTER));
    }

    private static boolean closed(Match match) {
        return Boolean.TRUE.equals(match.getFinished()) || match.getStatus() == MatchStatusNormalized.CANCELLED;
    }

    /**
     * Cuadro de una competición personalizada (rondas «bracket-N», con fechas opcionales): se ha jugado su
     * final si la última ronda es un solo cruce al que se llega desde dos.
     */
    private static boolean customFinalPlayed(List<Match> calendar) {
        Map<Integer, Long> ties = calendar.stream()
                .map(match -> CUSTOM_ROUND.matcher(match.getRound() == null ? "" : match.getRound()))
                .filter(Matcher::matches)
                .collect(Collectors.groupingBy(matcher -> Integer.parseInt(matcher.group(1)), Collectors.counting()));
        if (ties.isEmpty()) return false;
        int lastRound = Collections.max(ties.keySet());
        return ties.get(lastRound) == 1 && ties.getOrDefault(lastRound - 1, 2L) == 2;
    }

    /**
     * Ligas regulares y la Fórmula 1: todas sus jornadas o carreras se importan al empezar la temporada. No
     * las que siguen con eliminatorias (la Champions), que se sortean ronda a ronda, ni las personalizadas,
     * a las que su administrador puede añadir partidos.
     */
    private static boolean hasFixedCalendar(Competition competition) {
        if (competition.getOwnerLeague() != null || competition.hasOwnBracket()) return false;
        return "LEAGUE".equals(competition.getFormatType()) || competition.isFormulaOne();
    }
}
