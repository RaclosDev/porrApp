package com.porra.mundial.repository;

import com.porra.mundial.model.Team;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

/**
 * 🗄️ Repositorio de Equipos
 * Aquí pedimos a la Base de Datos cosas sobre las selecciones.
 */
@Repository
public interface TeamRepository extends JpaRepository<Team, Long> {
    List<Team> findByGroupNameOrderByName(String groupName);
    
    // Sacar todos los equipos ordenaditos
    List<Team> findAllByOrderByGroupNameAscNameAsc();
    
    // "Búscame el equipo por su nombre"
    Optional<Team> findByName(String name);
    
    // "Búscame el equipo por su nombre en inglés"
    Optional<Team> findByNameEn(String nameEn);
    
    // "Búscame a un equipo por su ID raro externo (para no duplicarlo al sincronizar)"
    Optional<Team> findByExternalId(String externalId);
}
