package com.porra.mundial.repository;

import com.porra.mundial.model.BracketPrediction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Repositorio JPA para BracketPrediction (Pronosticos de eliminatorias).
 */
@Repository
public interface BracketPredictionRepository extends JpaRepository<BracketPrediction, Long> {

    List<BracketPrediction> findByPredictionId(Long predictionId);

    default List<BracketPrediction> findByBetId(Long betId) {
        return findByPredictionId(betId);
    }
}
