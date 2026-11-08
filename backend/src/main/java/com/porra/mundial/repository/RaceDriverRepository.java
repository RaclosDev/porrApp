package com.porra.mundial.repository;

import com.porra.mundial.model.RaceDriver;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface RaceDriverRepository extends JpaRepository<RaceDriver, Long> {

    Optional<RaceDriver> findByExternalId(String externalId);

    List<RaceDriver> findByExternalIdIn(Collection<String> externalIds);
}
