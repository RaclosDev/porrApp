package com.porra.mundial.repository;

import com.porra.mundial.model.BetBackup;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface BetBackupRepository extends JpaRepository<BetBackup, Long> {
    
    // Encuentra todos los backups ordenados del más reciente al más antiguo
    List<BetBackup> findAllByOrderByBackupTimestampDesc();

    // Encuentra el historial de una apuesta concreta
    List<BetBackup> findByOriginalBetIdOrderByBackupTimestampDesc(Long originalBetId);
}
