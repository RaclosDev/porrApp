package com.porra.mundial.repository;

import com.porra.mundial.model.ConnectionLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Repository
public interface ConnectionLogRepository extends JpaRepository<ConnectionLog, Long> {
    List<ConnectionLog> findTop100ByOrderByConnectedAtDesc();
    List<ConnectionLog> findAllByOrderByConnectedAtDesc();
    @Transactional
    void deleteByParticipantNameIn(List<String> participantNames);
}
