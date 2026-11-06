package com.porra.mundial.repository;

import com.porra.mundial.model.UserAccount;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.dao.IncorrectResultSizeDataAccessException;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Cada servicio vuelve a buscar al usuario de la petición por su email. Dentro de una transacción
 * se recuerda el id encontrado y las siguientes búsquedas salen del contexto de persistencia sin
 * volver a consultar la base de datos.
 */
class UserAccountRepositoryImpl implements UserAccountLookup {

    private static final Object MEMO_KEY = new Object();

    @PersistenceContext
    private EntityManager entityManager;

    @Override
    public Optional<UserAccount> findByGoogleEmail(String googleEmail) {
        if (googleEmail == null) {
            return Optional.empty();
        }
        Map<String, Long> memo = transactionMemo();
        Long knownId = memo != null ? memo.get(googleEmail) : null;
        if (knownId != null) {
            UserAccount user = entityManager.find(UserAccount.class, knownId);
            if (user != null && googleEmail.equals(user.getGoogleEmail())) {
                return Optional.of(user);
            }
            memo.remove(googleEmail);
        }
        List<UserAccount> found = entityManager
                .createQuery("SELECT u FROM UserAccount u WHERE u.googleEmail = :email", UserAccount.class)
                .setParameter("email", googleEmail)
                .setMaxResults(2)
                .getResultList();
        if (found.size() > 1) {
            throw new IncorrectResultSizeDataAccessException(1, found.size());
        }
        if (found.isEmpty()) {
            return Optional.empty();
        }
        UserAccount user = found.get(0);
        if (memo != null) {
            memo.put(googleEmail, user.getId());
        }
        return Optional.of(user);
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Long> transactionMemo() {
        if (!TransactionSynchronizationManager.isSynchronizationActive()
                || !TransactionSynchronizationManager.isActualTransactionActive()) {
            return null;
        }
        Object bound = TransactionSynchronizationManager.getResource(MEMO_KEY);
        if (bound != null) {
            return (Map<String, Long>) bound;
        }
        Map<String, Long> memo = new HashMap<>();
        TransactionSynchronizationManager.bindResource(MEMO_KEY, memo);
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                TransactionSynchronizationManager.unbindResourceIfPossible(MEMO_KEY);
            }
        });
        return memo;
    }
}
