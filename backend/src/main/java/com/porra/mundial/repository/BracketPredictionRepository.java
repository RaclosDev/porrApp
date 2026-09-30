package com.porra.mundial.repository;

import com.porra.mundial.model.BracketPrediction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Repositorio JPA para BracketPrediction (Pronósticos de eliminatorias).
 */
@Repository
public interface BracketPredictionRepository extends JpaRepository<BracketPrediction, Long> {
    
    /**
     * @param betId ID de la apuesta.
     * @return Todas las predicciones de eliminatorias pertenecientes a la apuesta.
     */
    List<BracketPrediction> findByBetId(Long betId);
}
