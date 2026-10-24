package com.porra.mundial.repository;

import com.porra.mundial.model.GroupStanding;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

/**
 * Repositorio de la Clasificación de Grupos.
 * Gestiona el acceso a puntos, estadísticas y posiciones oficiales de la fase de grupos.
 */
@Repository
public interface GroupStandingRepository extends JpaRepository<GroupStanding, Long> {
    
    /**
     * "Dame todos los datos de un grupo concreto (ej. 'A')"
     */
    List<GroupStanding> findByGroupName(String groupName);
    
    /**
     * "Dame la clasificación de todo el Mundial, ordenada por grupos de la A a la L"
     */
    List<GroupStanding> findAllByOrderByGroupNameAsc();

    /**
     * "Dame la clasificación completa ordenada directamente por grupo y posición oficial"
     */
    List<GroupStanding> findAllByOrderByGroupNameAscPositionAsc();

    /**
     * "Dame todos los equipos clasificados en una posición concreta (ej. 3 para mejores terceros)"
     */
    List<GroupStanding> findByPositionOrderByPointsDescGoalDiffDescGoalsForDescFairPlayPointsDesc(Integer position);
    
    /**
     * "Búscame los puntos exactos de un equipo (por su ID) en su grupo"
     */
    Optional<GroupStanding> findByTeamIdAndGroupName(Long teamId, String groupName);
    
    /**
     * "Borra la clasificación antigua de un grupo (se usa cuando resincronizamos con la API)"
     */
    void deleteByGroupName(String groupName);
}
