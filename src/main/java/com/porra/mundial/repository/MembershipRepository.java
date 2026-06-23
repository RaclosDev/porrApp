package com.porra.mundial.repository;

import com.porra.mundial.model.Membership;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MembershipRepository extends JpaRepository<Membership, Membership.MembershipId> {
    List<Membership> findByUserParticipantName(String participantName);
    List<Membership> findByLeagueId(Long leagueId);
}
