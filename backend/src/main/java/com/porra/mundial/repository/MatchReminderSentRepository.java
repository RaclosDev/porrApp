package com.porra.mundial.repository;

import com.porra.mundial.model.MatchReminderSent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface MatchReminderSentRepository extends JpaRepository<MatchReminderSent, MatchReminderSent.Key> {

    @Query("SELECT r.id FROM MatchReminderSent r WHERE r.id.matchId IN :matchIds")
    List<MatchReminderSent.Key> findKeysByMatchIdIn(@Param("matchIds") Collection<Long> matchIds);
}
