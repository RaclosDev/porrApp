package com.porra.mundial.repository;

import com.porra.mundial.model.BetGroup;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

/**
 * Repositorio JPA para la gestión de Grupos (Ligas Privadas).
 */
public interface BetGroupRepository extends JpaRepository<BetGroup, Long> {
    
    /**
     * Busca un grupo por su código de invitación exacto.
     * @param joinCode El código alfanumérico.
     * @return Opcional del grupo encontrado.
     */
    Optional<BetGroup> findByJoinCode(String joinCode);
    
    /**
     * Busca todos los grupos administrados por un usuario específico.
     * @param adminParticipantName El participantName del usuario administrador.
     * @return Lista de grupos que administra.
     */
    List<BetGroup> findByAdminUserParticipantName(String adminParticipantName);
}
