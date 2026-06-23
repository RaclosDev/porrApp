package com.porra.mundial.repository;

import com.porra.mundial.model.Edition;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.List;

@Repository
public interface EditionRepository extends JpaRepository<Edition, Long> {
    Optional<Edition> findByLeagueIdAndStatus(Long leagueId, String status);
    List<Edition> findByLeagueId(Long leagueId);
}
