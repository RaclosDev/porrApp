package app.porrapp.service.league;

import app.porrapp.model.Competition;
import app.porrapp.model.Edition;
import app.porrapp.model.League;
import app.porrapp.repository.CompetitionRepository;
import app.porrapp.repository.LeagueRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.function.Predicate;

/**
 * Temporada de una liga: la de su competición. La liga termina cuando se archivan todas las competiciones
 * que sigue, y entonces su administrador puede repetirla para la temporada nueva.
 */
@Component
@RequiredArgsConstructor
public class LeagueSeasons {

    /**
     * @param season       etiqueta de la temporada que juega la liga ("2025/26"); null si no se sabe
     * @param ended        si esa temporada ya está archivada: la liga ha terminado
     * @param canRepeat    si ha terminado, hay temporada nueva y nadie la ha repetido aún
     * @param nextSeason   etiqueta de la temporada nueva cuando se puede repetir
     * @param nextLeagueId la liga que la repite, solo para quien también pertenece a ella
     */
    public record Status(String season, boolean ended, boolean canRepeat, String nextSeason, Long nextLeagueId) {
        static final Status NONE = new Status(null, false, false, null, null);
    }

    private final CompetitionRepository competitionRepository;
    private final LeagueRepository leagueRepository;

    /**
     * @param viewerBelongsTo si quien consulta es miembro de la liga con ese id: una liga privada no existe
     *                        para quien no lo es, tampoco como «la siguiente» de otra
     */
    @Transactional(readOnly = true)
    public Status status(League league, Edition edition, Predicate<Long> viewerBelongsTo) {
        if (league == null || edition == null) return Status.NONE;
        Competition played = edition.getCompetition();
        if (played == null || played.getOwnerLeague() != null) return Status.NONE;
        if (!ended(edition)) return new Status(played.getSeason(), false, false, null, null);

        Optional<League> next = leagueRepository.findByPreviousLeagueId(league.getId());
        if (next.isPresent()) {
            Long nextId = next.get().getId();
            return new Status(played.getSeason(), true, false, null, viewerBelongsTo.test(nextId) ? nextId : null);
        }
        Optional<Competition> current = currentSeason(played);
        return new Status(played.getSeason(), true, current.isPresent(),
                current.map(Competition::getSeason).orElse(null), null);
    }

    /** Si ya están archivadas todas las competiciones que sigue la liga (la suya y, si junta varias, el resto). */
    @Transactional(readOnly = true)
    public boolean ended(Edition edition) {
        Competition played = edition.getCompetition();
        if (played == null || !played.isArchived()) return false;
        return competitions(edition).stream().allMatch(Competition::isArchived);
    }

    /** La competición de la liga primero y, si junta varias, las demás. */
    @Transactional(readOnly = true)
    public List<Competition> competitions(Edition edition) {
        Competition played = edition.getCompetition();
        List<Competition> all = new ArrayList<>(List.of(played));
        if (edition.isMultiCompetition() && edition.getId() != null) {
            competitionRepository.findByEditionId(edition.getId()).stream()
                    .filter(item -> !item.getId().equals(played.getId()))
                    .forEach(all::add);
        }
        return all;
    }

    /** La fila vigente de una competición archivada: su temporada nueva, si el proveedor ya la ha abierto. */
    @Transactional(readOnly = true)
    public Optional<Competition> currentSeason(Competition archived) {
        if (archived.getExternalId() == null || archived.getExternalId().isBlank()) return Optional.empty();
        return competitionRepository.findByExternalId(archived.getExternalId());
    }
}
