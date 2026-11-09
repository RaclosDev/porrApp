package app.porrapp.repository;

import app.porrapp.model.MatchdayFinishedNotice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface MatchdayFinishedNoticeRepository
        extends JpaRepository<MatchdayFinishedNotice, MatchdayFinishedNotice.Key> {

    @Query("SELECT n.id FROM MatchdayFinishedNotice n WHERE n.id.editionId IN :editionIds")
    List<MatchdayFinishedNotice.Key> findKeysByEditionIdIn(@Param("editionIds") Collection<Long> editionIds);
}
