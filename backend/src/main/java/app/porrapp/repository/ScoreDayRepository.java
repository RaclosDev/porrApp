package app.porrapp.repository;

import app.porrapp.model.ScoreDay;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ScoreDayRepository extends JpaRepository<ScoreDay, Long> {

    List<ScoreDay> findByLeagueIdOrderByIdAsc(Long leagueId);

    Optional<ScoreDay> findFirstByLeagueIdAndClosedAtIsNullOrderByIdDesc(Long leagueId);
}
