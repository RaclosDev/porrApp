package app.porrapp.repository;

import app.porrapp.model.ScoreDayPlayer;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface ScoreDayPlayerRepository extends JpaRepository<ScoreDayPlayer, ScoreDayPlayer.Key> {

    List<ScoreDayPlayer> findByDayIdIn(Collection<Long> dayIds);

    List<ScoreDayPlayer> findByDayId(Long dayId);

    List<ScoreDayPlayer> findByPlayerId(Long playerId);
}
