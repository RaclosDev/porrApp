package com.porra.mundial.repository;

import com.porra.mundial.model.PredictionBackup;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Repositorio JPA para copias de seguridad de pronosticos (PredictionBackup).
 */
@Repository
public interface PredictionBackupRepository extends JpaRepository<PredictionBackup, Long> {

    List<PredictionBackup> findAllByOrderByBackupTimestampDesc();

    List<PredictionBackup> findByOriginalPredictionIdOrderByBackupTimestampDesc(Long originalPredictionId);

    default List<PredictionBackup> findByOriginalBetIdOrderByBackupTimestampDesc(Long originalBetId) {
        return findByOriginalPredictionIdOrderByBackupTimestampDesc(originalBetId);
    }
}
