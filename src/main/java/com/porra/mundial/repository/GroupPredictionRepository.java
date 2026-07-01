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
    
    /**
     * @param betId ID de la apuesta.
     * @return Todas las predicciones de la fase de grupos asociadas a esta apuesta.
     */
    List<GroupPrediction> findByBetId(Long betId);
}
