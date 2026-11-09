package app.porrapp.repository;

import app.porrapp.model.ScorerPick;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ScorerPickRepository extends JpaRepository<ScorerPick, Long> {

    /** Pichichis de las porras de una edición. */
    @Query("SELECT s FROM ScorerPick s WHERE s.predictionId IN"
            + " (SELECT p.id FROM Prediction p WHERE p.edition.id = :editionId)")
    List<ScorerPick> findByEditionId(@Param("editionId") Long editionId);
}
