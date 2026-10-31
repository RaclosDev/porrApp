package com.porra.mundial.service;

import com.porra.mundial.model.Membership;
import com.porra.mundial.model.UserAccount;
import com.porra.mundial.repository.MembershipRepository;
import com.porra.mundial.repository.PredictionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.NoSuchElementException;

/** Updates the membership and its predictions together after the caller checks league administration. */
@Service
@RequiredArgsConstructor
public class LeaguePaymentService {
    private final MembershipRepository membershipRepository;
    private final PredictionRepository predictionRepository;

    @Transactional
    public void setPayment(Long leagueId, Long userId, String status, UserAccount markedBy) {
        Membership membership = membershipRepository.findById(new Membership.MembershipId(userId, leagueId))
                .orElseThrow(() -> new NoSuchElementException("Membresía no encontrada"));
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
