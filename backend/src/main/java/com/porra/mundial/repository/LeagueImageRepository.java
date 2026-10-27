package com.porra.mundial.repository;

import com.porra.mundial.model.LeagueImage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface LeagueImageRepository extends JpaRepository<LeagueImage, Long> {
}
