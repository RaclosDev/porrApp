package app.porrapp.repository;

import app.porrapp.model.EditionFollowedTeam;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface EditionFollowedTeamRepository extends JpaRepository<EditionFollowedTeam, EditionFollowedTeam.Key> {

    @Query("SELECT f.id.teamId FROM EditionFollowedTeam f WHERE f.id.editionId = :editionId")
    List<Long> findTeamIds(@Param("editionId") Long editionId);

    @Query("SELECT f FROM EditionFollowedTeam f WHERE f.id.editionId = :editionId")
    List<EditionFollowedTeam> findByEditionId(@Param("editionId") Long editionId);
}
