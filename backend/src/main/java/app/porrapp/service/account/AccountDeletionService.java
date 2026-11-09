package app.porrapp.service.account;

import app.porrapp.service.league.LeagueService;
import app.porrapp.service.league.LeagueMembershipService;
import app.porrapp.exception.BusinessException;
import app.porrapp.model.League;
import app.porrapp.model.Membership;
import app.porrapp.model.UserAccount;
import app.porrapp.repository.LeagueRepository;
import app.porrapp.repository.MembershipRepository;
import app.porrapp.repository.PredictionRepository;
import app.porrapp.repository.UserAccountRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Derecho de supresión (art. 17 RGPD): borra la cuenta y todos sus datos en una transacción.
 * Predicciones y membresías se borran aquí; foto, sesiones, suscripciones push y avisos enviados
 * caen con la cuenta por {@code ON DELETE CASCADE}. Quien administra una liga con más miembros
 * debe cederla o borrarla antes; las ligas en las que está solo se borran con la cuenta.
 * Las cuentas inactivas se borran igual, pero sus ligas compartidas pasan al miembro más antiguo.
 */
@Service
@RequiredArgsConstructor
public class AccountDeletionService {

    private final UserAccountRepository userAccountRepository;
    private final LeagueRepository leagueRepository;
    private final MembershipRepository membershipRepository;
    private final PredictionRepository predictionRepository;
    private final LeagueService leagueService;
    private final LeagueMembershipService membershipService;

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
        erase(user, administered);
    }

    /**
     * Borra una cuenta inactiva. Cada liga que administra con más miembros pasa al miembro que
     * lleva más tiempo en ella, para que la liga siga viva; las ligas en las que está solo se borran.
     */
    @Transactional
    @CacheEvict(value = {"userGroups", "groupById", "groupByCode", "leaderboard"}, allEntries = true)
    public void deleteInactiveAccount(Long userId) {
        Optional<UserAccount> found = userAccountRepository.findById(userId);
        if (found.isEmpty()) {
            return;
        }
        UserAccount user = found.get();
        List<League> alone = new ArrayList<>();
        for (League league : leagueRepository.findByAdminUserId(userId)) {
            Optional<Membership> heir = membershipRepository.findByLeagueId(league.getId()).stream()
                    .filter(m -> !m.getId().getUserId().equals(userId))
                    .min(Comparator.comparing(Membership::getJoinedAt,
                            Comparator.nullsLast(Comparator.<Instant>naturalOrder())));
            if (heir.isPresent()) {
                membershipService.transferAdmin(league.getId(), heir.get().getId().getUserId(), user.getGoogleEmail());
            } else {
                alone.add(league);
            }
        }
        erase(user, alone);
    }

    private void erase(UserAccount user, List<League> leaguesToDelete) {
        leaguesToDelete.forEach(l -> leagueService.deleteLeague(l.getId(), user.getGoogleEmail()));

        predictionRepository.clearPaymentMarkedBy(user.getId());
        predictionRepository.deleteAll(predictionRepository.findByUserId(user.getId()));
        membershipRepository.deleteAll(membershipRepository.findByUserId(user.getId()));
        predictionRepository.flush();
        membershipRepository.flush();
        userAccountRepository.delete(user);
    }
}
