package app.porrapp.repository;

import app.porrapp.model.ScoreGame;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ScoreGameRepository extends JpaRepository<ScoreGame, Long> {
    List<ScoreGame> findByLeagueIdOrderByIdAsc(Long leagueId);
    long countByLeagueId(Long leagueId);
}
