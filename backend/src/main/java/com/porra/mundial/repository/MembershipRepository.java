package com.porra.mundial.repository;

import com.porra.mundial.model.Membership;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MembershipRepository extends JpaRepository<Membership, Membership.MembershipId> {
    
    @EntityGraph(attributePaths = "user")
    List<Membership> findByLeagueId(Long leagueId);

    long countByLeagueId(Long leagueId);

    List<Membership> findByUserId(Long userId);
}
