package com.porra.mundial.service.account;

import com.porra.mundial.dto.UserDataExport;
import com.porra.mundial.exception.BusinessException;
import com.porra.mundial.model.MatchPrediction;
import com.porra.mundial.model.Prediction;
import com.porra.mundial.model.UserAccount;
import com.porra.mundial.repository.MatchPredictionRepository;
import com.porra.mundial.repository.MembershipRepository;
import com.porra.mundial.repository.PasskeyRepository;
import com.porra.mundial.repository.PredictionRepository;
import com.porra.mundial.repository.PushNotificationLogRepository;
import com.porra.mundial.repository.PushSubscriptionRepository;
import com.porra.mundial.repository.UserAccountRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/** Reúne los datos personales del usuario para descargarlos (arts. 15 y 20 RGPD). */
@Service
@RequiredArgsConstructor
public class UserDataExportService {

    private final UserAccountRepository userAccountRepository;
    private final MembershipRepository membershipRepository;
    private final PredictionRepository predictionRepository;
    private final MatchPredictionRepository matchPredictionRepository;
    private final PushSubscriptionRepository pushSubscriptionRepository;
    private final PushNotificationLogRepository pushNotificationLogRepository;
    private final PasskeyRepository passkeyRepository;

    @Transactional(readOnly = true)
    public UserDataExport export(String email) {
        UserAccount user = userAccountRepository.findByGoogleEmail(email)
                .orElseThrow(() -> BusinessException.notFound("Usuario no encontrado"));

        var profile = new UserDataExport.Profile(user.getGoogleEmail(), user.getParticipantName(), user.getLinkedAt(),
                user.getLastActiveAt(), user.getAvatarKey() != null, user.isMatchRemindersEnabled(), user.isMemberJoinedAlertsEnabled());

        var leagues = membershipRepository.findByUserId(user.getId()).stream()
                .map(m -> new UserDataExport.LeagueMembership(m.getLeague().getId(), m.getLeague().getName(),
                        m.getRole(), m.getPaymentStatus(), m.getJoinedAt()))
                .sorted(Comparator.comparing(UserDataExport.LeagueMembership::leagueId))
                .toList();

        List<Prediction> predictions = predictionRepository.findByUserGoogleEmailWithUserAndEdition(email);
        Map<Long, List<MatchPrediction>> picksByPrediction = predictions.isEmpty() ? Map.of()
                : matchPredictionRepository.findWithMatchByPredictionIdIn(
                                predictions.stream().map(Prediction::getId).toList()).stream()
                        .collect(Collectors.groupingBy(mp -> mp.getPrediction().getId()));

        var predictionExports = predictions.stream()
                .sorted(Comparator.comparing(Prediction::getId))
                .map(p -> new UserDataExport.PredictionExport(p.getId(), p.getEdition().getLeague().getId(),
                        p.getEdition().getLeague().getName(), p.getName(), p.getPaymentStatus(), p.getPaymentAmount(),
                        p.getTotalPoints(), p.getCreatedAt(), p.getBracketData(),
                        picksByPrediction.getOrDefault(p.getId(), List.of()).stream()
                                .sorted(Comparator.comparing(mp -> mp.getMatch().getId()))
                                .map(mp -> new UserDataExport.MatchPick(mp.getMatch().getId(), mp.getHomeScore(),
                                        mp.getAwayScore(), mp.getPredictionSign(), mp.getPointsAwarded(),
                                        mp.getUpdatedAt()))
                                .toList()))
                .toList();

        var devices = pushSubscriptionRepository.findByUserIdIn(List.of(user.getId())).stream()
                .map(s -> new UserDataExport.PushDevice(s.getCreatedAt()))
                .toList();

        var notifications = pushNotificationLogRepository.findByUserIdOrderBySentAtDesc(user.getId()).stream()
                .map(n -> new UserDataExport.SentNotification(n.getTitle(), n.getBody(), n.getSentAt()))
                .toList();

        var passkeys = passkeyRepository.findByUserIdOrderByCreatedAtAsc(user.getId()).stream()
                .map(p -> new UserDataExport.PasskeyExport(p.getName(), p.getCreatedAt(), p.getLastUsedAt()))
                .toList();

        return new UserDataExport(Instant.now(), profile, leagues, predictionExports, devices, notifications, passkeys);
    }
}
