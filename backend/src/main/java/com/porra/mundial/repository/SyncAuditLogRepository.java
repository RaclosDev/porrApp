package com.porra.mundial.repository;

import com.porra.mundial.model.SyncAuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repositorio Spring Data JPA para logs de auditoría de sincronización deportiva.
 */
@Repository
public interface SyncAuditLogRepository extends JpaRepository<SyncAuditLog, Long> {

    List<SyncAuditLog> findTop20ByOrderBySyncedAtDesc();

    List<SyncAuditLog> findByCompetitionIdOrderBySyncedAtDesc(Long competitionId);

    Optional<SyncAuditLog> findTopByOrderBySyncedAtDesc();
}
