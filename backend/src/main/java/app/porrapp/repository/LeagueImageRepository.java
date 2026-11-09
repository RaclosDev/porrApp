package app.porrapp.repository;

import app.porrapp.model.LeagueImage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface LeagueImageRepository extends JpaRepository<LeagueImage, Long> {
}
