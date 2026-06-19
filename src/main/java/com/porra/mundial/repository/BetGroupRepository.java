package com.porra.mundial.repository;

import com.porra.mundial.model.BetGroup;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface BetGroupRepository extends JpaRepository<BetGroup, Long> {
    Optional<BetGroup> findByJoinCode(String joinCode);
    List<BetGroup> findByAdminParticipantName(String adminParticipantName);
}
