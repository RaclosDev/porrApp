package app.porrapp.repository;

import app.porrapp.model.EditionMatchChoice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface EditionMatchChoiceRepository extends JpaRepository<EditionMatchChoice, EditionMatchChoice.Key> {

    @Query("SELECT c FROM EditionMatchChoice c WHERE c.id.editionId = :editionId")
    List<EditionMatchChoice> findByEditionId(@Param("editionId") Long editionId);
}
