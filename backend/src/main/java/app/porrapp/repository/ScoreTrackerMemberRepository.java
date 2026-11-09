package app.porrapp.repository;

import app.porrapp.model.ScoreTrackerMember;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ScoreTrackerMemberRepository
        extends JpaRepository<ScoreTrackerMember, ScoreTrackerMember.Key> {

    List<ScoreTrackerMember> findByUserId(Long userId);

    List<ScoreTrackerMember> findByTrackerId(Long trackerId);
}
