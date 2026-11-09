package app.porrapp.service.league;

import app.porrapp.exception.BusinessException;
import app.porrapp.model.Membership;
import app.porrapp.model.UserAccount;
import app.porrapp.repository.MembershipRepository;
import app.porrapp.repository.PredictionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Updates the membership and its predictions together after the caller checks league administration. */
@Service
@RequiredArgsConstructor
public class LeaguePaymentService {
    private final MembershipRepository membershipRepository;
    private final PredictionRepository predictionRepository;

    @Transactional
    public void setPayment(Long leagueId, Long userId, String status, UserAccount markedBy) {
        Membership membership = membershipRepository.findById(new Membership.MembershipId(userId, leagueId))
                .orElseThrow(() -> BusinessException.notFound("Membresía no encontrada"));
        String normalized = "PAID".equalsIgnoreCase(status) ? "PAID" : "PENDING";
        membership.setPaymentStatus(normalized);
        membershipRepository.save(membership);
        for (var prediction : predictionRepository.findByUserIdAndEditionLeagueId(userId, leagueId)) {
            prediction.setPaymentStatus(normalized);
            prediction.setPaymentMarkedBy(markedBy);
            predictionRepository.save(prediction);
        }
    }
}
