package com.porra.mundial.repository;

import com.porra.mundial.model.Prediction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repositorio JPA para Pronosticos (Prediction).
 */
@Repository
public interface PredictionRepository extends JpaRepository<Prediction, Long> {

    List<Prediction> findByPaymentStatus(String paymentStatus);

    List<Prediction> findAllByOrderByCreatedAtDesc();

    List<Prediction> findByEditionLeagueId(Long groupId);

    @Query("SELECT p FROM Prediction p LEFT JOIN FETCH p.user LEFT JOIN FETCH p.edition e LEFT JOIN FETCH e.league l WHERE l.id = :groupId OR (:groupId = 1 AND (p.edition IS NULL OR l.id IS NULL))")
    List<Prediction> findByEditionLeagueIdWithUserAndEdition(@Param("groupId") Long groupId);

    @Query("SELECT p FROM Prediction p LEFT JOIN FETCH p.user LEFT JOIN FETCH p.edition e LEFT JOIN FETCH e.league WHERE p.user.googleEmail = :email")
    List<Prediction> findByUserGoogleEmailWithUserAndEdition(@Param("email") String email);

    @Query("SELECT p FROM Prediction p LEFT JOIN FETCH p.user LEFT JOIN FETCH p.edition")
    List<Prediction> findAllWithUserAndEdition();

    List<Prediction> findByEditionLeagueIdOrderByTotalPointsDesc(Long groupId);

    List<Prediction> findAllByOrderByTotalPointsDesc();

    List<Prediction> findByUserGoogleEmail(String email);

    Optional<Prediction> findByUserGoogleEmailAndEditionLeagueId(String email, Long groupId);

    Optional<Prediction> findByName(String name);

    @Query("SELECT p FROM Prediction p WHERE p.name = :betName")
    Optional<Prediction> findByBetName(@Param("betName") String betName);

    Optional<Prediction> findByIsOfficialTrue();

    Optional<Prediction> findByEditionIdAndIsOfficialTrue(Long editionId);

    @org.springframework.data.jpa.repository.Modifying
    @Query("UPDATE Prediction p SET p.scoreCalculatedAt = null")
    void invalidateAllScores();
}
