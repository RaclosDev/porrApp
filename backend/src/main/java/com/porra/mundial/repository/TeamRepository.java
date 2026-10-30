package com.porra.mundial.repository;

import com.porra.mundial.model.Team;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface TeamRepository extends JpaRepository<Team, Long> {
    
    List<Team> findAllByOrderByGroupNameAscNameAsc();
    
    Optional<Team> findByName(String name);
    
    Optional<Team> findByExternalId(String externalId);

    /** Hay algún equipo con grupo asignado ("-" marca los que no juegan fase de grupos). */
    boolean existsByGroupNameIsNotNullAndGroupNameNot(String excludedGroup);
}
