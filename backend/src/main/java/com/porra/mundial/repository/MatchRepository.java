package com.porra.mundial.repository;

import com.porra.mundial.model.Match;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

/**
 * Repositorio de Partidos.
 */
@Repository
public interface MatchRepository extends JpaRepository<Match, Long> {
    
    List<Match> findByGroupNameOrderByMatchDateAsc(String groupName);
    
    List<Match> findByFinishedTrueOrderByMatchDateDesc();
    
    List<Match> findByFinishedFalseOrderByMatchDateAsc();
    
    List<Match> findByRoundOrderByMatchDateAsc(String round);
    
    Optional<Match> findByExternalId(String externalId);

    List<Match> findByCompetitionId(Long competitionId);

    List<Match> findByCompetitionIdOrderByMatchDateAsc(Long competitionId);

    long countByCompetitionId(Long competitionId);
}
