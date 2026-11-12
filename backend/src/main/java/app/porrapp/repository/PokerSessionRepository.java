package app.porrapp.repository;

import app.porrapp.model.PokerSession;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PokerSessionRepository extends JpaRepository<PokerSession, Long> {
    List<PokerSession> findByLeagueIdAndClosedAtIsNotNullOrderByScheduledOnDescIdDesc(Long leagueId);

    Optional<PokerSession> findByLeagueIdAndClosedAtIsNull(Long leagueId);

    Optional<PokerSession> findByIdAndLeagueId(Long id, Long leagueId);

    boolean existsByLeagueIdAndClosedAtIsNull(Long leagueId);
}
