package com.porra.mundial.repository;

import com.porra.mundial.model.GroupPrediction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface GroupPredictionRepository extends JpaRepository<GroupPrediction, Long> {
    List<GroupPrediction> findByBetId(Long betId);
}
