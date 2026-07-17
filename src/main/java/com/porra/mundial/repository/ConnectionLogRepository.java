package com.porra.mundial.repository;

import com.porra.mundial.model.ConnectionLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Repositorio JPA para registrar conexiones de usuarios.
 */
@Repository
public interface ConnectionLogRepository extends JpaRepository<ConnectionLog, Long> {
    
    /**
     * @return Los últimos 100 registros de conexión ordenados por fecha descendente.
     */
    List<ConnectionLog> findTop100ByOrderByConnectedAtDesc();
    
    /**
     * @return Todo el historial de conexiones ordenado de más reciente a más antiguo.
     */
    List<ConnectionLog> findAllByOrderByConnectedAtDesc();
    
    /**
     * Borra los registros de los participantes especificados.
     * @param participantNames Lista de nombres de participantes.
     */
    @Transactional
    void deleteByParticipantNameIn(List<String> participantNames);
}
