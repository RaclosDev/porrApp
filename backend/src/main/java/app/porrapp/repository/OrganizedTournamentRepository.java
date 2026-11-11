package app.porrapp.repository;

import app.porrapp.model.OrganizedTournament;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.util.Optional;
import java.util.UUID;

public interface OrganizedTournamentRepository extends JpaRepository<OrganizedTournament, Long> {
    Optional<OrganizedTournament> findByPublicIdAndPublishedTrue(UUID publicId);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from OrganizedTournament t where t.id = :id")
    Optional<OrganizedTournament> findLocked(@Param("id") Long id);
}
