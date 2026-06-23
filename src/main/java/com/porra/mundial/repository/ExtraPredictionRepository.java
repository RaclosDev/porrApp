package com.porra.mundial.repository;

import com.porra.mundial.model.ExtraPrediction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ExtraPredictionRepository extends JpaRepository<ExtraPrediction, Long> {
}
