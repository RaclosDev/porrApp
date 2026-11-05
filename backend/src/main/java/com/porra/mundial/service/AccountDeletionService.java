package com.porra.mundial.service;

import com.porra.mundial.exception.BusinessException;
import com.porra.mundial.model.League;
import com.porra.mundial.model.UserAccount;
import com.porra.mundial.repository.LeagueRepository;
import com.porra.mundial.repository.MembershipRepository;
import com.porra.mundial.repository.PredictionRepository;
import com.porra.mundial.repository.UserAccountRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Derecho de supresión (art. 17 RGPD): borra la cuenta y todos sus datos en una transacción.
 * Predicciones y membresías se borran aquí; foto, sesiones, suscripciones push y avisos enviados
 * caen con la cuenta por {@code ON DELETE CASCADE}. Quien administra una liga con más miembros
 * debe cederla o borrarla antes; las ligas en las que está solo se borran con la cuenta.
 */
@Service
@RequiredArgsConstructor
public class AccountDeletionService {

    private final UserAccountRepository userAccountRepository;
    private final LeagueRepository leagueRepository;
    private final MembershipRepository membershipRepository;
    private final PredictionRepository predictionRepository;
    private final GroupService groupService;

    @Transactional
    @CacheEvict(value = {"userGroups", "groupById", "groupByCode", "leaderboard"}, allEntries = true)
    public void deleteAccount(String email) {
        UserAccount user = userAccountRepository.findByGoogleEmail(email)
                .orElseThrow(() -> BusinessException.notFound("Usuario no encontrado"));

        List<League> administered = leagueRepository.findByAdminUserId(user.getId());
        List<League> shared = administered.stream()
                .filter(l -> membershipRepository.countByLeagueId(l.getId()) > 1)
                .toList();
        if (!shared.isEmpty()) {
            String names = shared.stream().map(League::getName).collect(Collectors.joining(", "));
            throw BusinessException.conflict(
                    "Antes de borrar tu cuenta, cede la administración o borra estas ligas: " + names);
        }
        administered.forEach(l -> groupService.deleteGroup(l.getId(), email));

        predictionRepository.clearPaymentMarkedBy(user.getId());
        predictionRepository.deleteAll(predictionRepository.findByUserId(user.getId()));
        membershipRepository.deleteAll(membershipRepository.findByUserId(user.getId()));
        predictionRepository.flush();
        membershipRepository.flush();
        userAccountRepository.delete(user);
    }
}
