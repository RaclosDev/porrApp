package app.porrapp.repository;

import app.porrapp.model.Membership;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MembershipRepository extends JpaRepository<Membership, Membership.MembershipId> {
    
    @EntityGraph(attributePaths = "user")
    List<Membership> findByLeagueId(Long leagueId);

    long countByLeagueId(Long leagueId);

    List<Membership> findByUserId(Long userId);

    /** Borra en una sentencia todas las pertenencias a una liga. */
    @Modifying(flushAutomatically = true)
    @Query("DELETE FROM Membership m WHERE m.league.id = :leagueId")
    int deleteByLeagueId(@Param("leagueId") Long leagueId);
}
