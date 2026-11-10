package app.porrapp.repository;

import app.porrapp.model.ScoreSessionPlayer;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface ScoreSessionPlayerRepository extends JpaRepository<ScoreSessionPlayer, ScoreSessionPlayer.Key> {

    List<ScoreSessionPlayer> findBySessionIdIn(Collection<Long> sessionIds);

    List<ScoreSessionPlayer> findBySessionId(Long sessionId);
}
