package com.porra.mundial.repository;

import com.porra.mundial.model.League;
import com.porra.mundial.model.UserAccount;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface LeagueRepository extends JpaRepository<League, Long> {
    
    Optional<League> findByJoinCode(String joinCode);

    List<League> findByNameAndAdminUser(String name, UserAccount adminUser);

    List<League> findByAdminUserId(Long adminUserId);

    /** La liga pública más antigua: la que se enseña en la portada y en la demo. */
    Optional<League> findFirstByPublicLeagueTrueOrderByIdAsc();
}
