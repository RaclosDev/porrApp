package com.porra.mundial.repository;

import com.porra.mundial.model.BetBackup;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * 🗄️ Repositorio para la entidad BetBackup.
 * Proporciona métodos de acceso a datos para el historial de modificaciones de apuestas.
 */
@Repository
public interface BetBackupRepository extends JpaRepository<BetBackup, Long> {
    
    /**
     * @return Todos los backups de todas las apuestas ordenados del más reciente al más antiguo.
     */
    List<BetBackup> findAllByOrderByBackupTimestampDesc();

    /**
     * @param originalBetId El ID de la apuesta original en la tabla bets_v2.
     * @return El historial de cambios de una apuesta concreta.
     */
    List<BetBackup> findByOriginalBetIdOrderByBackupTimestampDesc(Long originalBetId);
}
