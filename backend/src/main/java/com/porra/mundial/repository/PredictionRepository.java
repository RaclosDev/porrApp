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

    List<Prediction> findByUserGoogleEmail(String email);

    Optional<Prediction> findByUserGoogleEmailAndEditionLeagueId(String email, Long groupId);

    Optional<Prediction> findByName(String name);

    @Query("SELECT p FROM Prediction p WHERE p.name = :betName")
    Optional<Prediction> findByBetName(@Param("betName") String betName);

    Optional<Prediction> findByIsOfficialTrue();

    Optional<Prediction> findByEditionIdAndIsOfficialTrue(Long editionId);
}
