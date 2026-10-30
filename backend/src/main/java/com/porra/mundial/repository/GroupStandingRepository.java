package com.porra.mundial.repository;

import com.porra.mundial.model.GroupStanding;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

/**
 * Repositorio de la Clasificación de Grupos.
 * Gestiona el acceso a puntos, estadísticas y posiciones oficiales de la fase de grupos.
 */
@Repository
public interface GroupStandingRepository extends JpaRepository<GroupStanding, Long> {
    
    /**
     * "Dame la clasificación de todo el Mundial, ordenada por grupos de la A a la L"
     */
    List<GroupStanding> findAllByOrderByGroupNameAsc();

    /**
     * "Dame la clasificación completa ordenada directamente por grupo y posición oficial"
     */
    List<GroupStanding> findAllByOrderByGroupNameAscPositionAsc();
}
