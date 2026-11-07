package com.porra.mundial.repository;

import com.porra.mundial.model.RaceWeekend;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface RaceWeekendRepository extends JpaRepository<RaceWeekend, Long> {

    List<RaceWeekend> findByMatchIdIn(Collection<Long> matchIds);
}
