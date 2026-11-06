package com.porra.mundial.repository;

import com.porra.mundial.model.UserAccount;

import java.util.Optional;

/** Búsqueda del usuario por email que reutiliza el resultado dentro de la misma transacción. */
public interface UserAccountLookup {

    Optional<UserAccount> findByGoogleEmail(String googleEmail);
}
