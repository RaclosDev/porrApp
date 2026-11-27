package app.porrapp.repository;

import app.porrapp.model.MatchSyncIncident;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface MatchSyncIncidentRepository extends JpaRepository<MatchSyncIncident, Long> {

    /** La incidencia más reciente de un tipo para un partido, abierta o cerrada. */
    Optional<MatchSyncIncident> findFirstByMatchIdAndKindOrderByIdDesc(Long matchId, MatchSyncIncident.Kind kind);

    List<MatchSyncIncident> findByMatchIdInAndKindAndStatusIn(Collection<Long> matchIds, MatchSyncIncident.Kind kind,
                                                              Collection<MatchSyncIncident.Status> statuses);

    List<MatchSyncIncident> findByStatusInOrderByLastSeenAtDesc(Collection<MatchSyncIncident.Status> statuses);

    @Query("SELECT i FROM MatchSyncIncident i WHERE i.status NOT IN :open ORDER BY i.resolvedAt DESC NULLS LAST, i.id DESC")
    List<MatchSyncIncident> findRecentlyResolved(@Param("open") Collection<MatchSyncIncident.Status> open, Pageable page);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT i FROM MatchSyncIncident i WHERE i.id = :id")
    Optional<MatchSyncIncident> findByIdForUpdate(@Param("id") Long id);
}
