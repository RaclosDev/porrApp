package com.porra.mundial.repository;

import com.porra.mundial.model.GroupPrediction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Repositorio JPA para las predicciones de Fase de Grupos.
 */
@Repository
public interface GroupPredictionRepository extends JpaRepository<GroupPrediction, Long> {

    List<GroupPrediction> findByPredictionId(Long predictionId);

    default List<GroupPrediction> findByBetId(Long betId) {
        return findByPredictionId(betId);
    }
}
