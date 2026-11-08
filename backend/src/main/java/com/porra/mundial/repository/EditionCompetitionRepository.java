package com.porra.mundial.repository;

import com.porra.mundial.model.EditionCompetition;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface EditionCompetitionRepository extends JpaRepository<EditionCompetition, EditionCompetition.Key> {

    @Query("SELECT c.id.competitionId FROM EditionCompetition c WHERE c.id.editionId = :editionId")
    List<Long> findCompetitionIds(@Param("editionId") Long editionId);

    @Query("SELECT c FROM EditionCompetition c WHERE c.id.editionId = :editionId")
    List<EditionCompetition> findByEditionId(@Param("editionId") Long editionId);
}
