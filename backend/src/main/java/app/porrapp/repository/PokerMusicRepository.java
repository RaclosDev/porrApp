package app.porrapp.repository;

import app.porrapp.model.PokerMusicItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PokerMusicRepository extends JpaRepository<PokerMusicItem, Long> {
    List<PokerMusicItem> findByLeagueIdOrderByIdAsc(Long leagueId);

    Optional<PokerMusicItem> findByIdAndLeagueId(Long id, Long leagueId);

    long countByLeagueId(Long leagueId);

    long countByLeagueIdAndAddedBy(Long leagueId, Long addedBy);

    boolean existsByLeagueIdAndVideoId(Long leagueId, String videoId);
}
