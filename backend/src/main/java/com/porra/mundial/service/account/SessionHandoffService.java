package com.porra.mundial.service.account;

import com.porra.mundial.model.SessionHandoff;
import com.porra.mundial.model.UserAccount;
import com.porra.mundial.repository.SessionHandoffRepository;
import com.porra.mundial.repository.UserAccountRepository;
import com.porra.mundial.service.account.SessionService.SessionTokens;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Optional;

/**
 * Traspaso de sesión de Safari a la app instalada en iPhone.
 * <p>
 * En iOS la app añadida a la pantalla de inicio tiene su propio almacenamiento. Al añadirla, iOS
 * (17.2 o posterior) le copia las cookies de Safari, pero nada más. Reusar el refresh token copiado
 * no sirve: Safari y la app tendrían el mismo token, y el segundo que lo rotara parecería una
 * reutilización y cerraría la sesión de los dos. Por eso, con la guía de instalación abierta, Safari
 * pide un código de traspaso que viaja en su propia cookie; la app lo canjea la primera vez que se
 * abre por una sesión nueva e independiente de la misma cuenta.
 * <ul>
 *   <li>Un solo uso: el canje borra el código, también si ha caducado.</li>
 *   <li>Vive {@link #HANDOFF_TTL} y cada cuenta tiene como mucho uno: pedir otro anula el anterior.</li>
 *   <li>Solo se guarda su SHA-256 y nunca va en una URL, así que no queda en logs ni en el Referer.</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SessionHandoffService {

    /** Tiempo para añadir la app a la pantalla de inicio y abrirla por primera vez. */
    public static final Duration HANDOFF_TTL = Duration.ofMinutes(30);

    private static final int CODE_BYTES = 32;
    private static final SecureRandom RANDOM = new SecureRandom();

    private final SessionHandoffRepository handoffRepository;
    private final UserAccountRepository userAccountRepository;
    private final SessionService sessionService;

    /** Prepara un traspaso para la cuenta del email y devuelve el código. Vacío si la cuenta no existe. */
    @Transactional
    public Optional<Handoff> prepare(String email) {
        return Optional.ofNullable(email)
                .flatMap(userAccountRepository::findByGoogleEmail)
                .map(this::prepare);
    }

    /**
     * Gasta el código y abre una sesión nueva de la cuenta que lo pidió. Vacío si no vale:
     * desconocido, ya usado o caducado.
     */
    @Transactional
    public Optional<SessionTokens> redeem(String code) {
        if (code == null || code.isBlank()) {
            return Optional.empty();
        }
        Optional<SessionHandoff> found = handoffRepository.findByCodeHashForUpdate(SessionService.hash(code));
        if (found.isEmpty()) {
            return Optional.empty();
        }
        SessionHandoff handoff = found.get();
        handoffRepository.delete(handoff);
        if (!Instant.now().isBefore(handoff.getExpiresAt())) {
            return Optional.empty();
        }
        Optional<UserAccount> user = userAccountRepository.findById(handoff.getUserId());
        user.ifPresent(u -> log.info("Sesión traspasada a la app instalada (usuario {}).", u.getId()));
        return user.map(sessionService::start);
    }

    private Handoff prepare(UserAccount user) {
        handoffRepository.deleteByUserId(user.getId());
        Instant now = Instant.now();
        Instant expiresAt = now.plus(HANDOFF_TTL);
        String code = newCode();
        handoffRepository.save(SessionHandoff.builder()
                .userId(user.getId())
                .codeHash(SessionService.hash(code))
                .createdAt(now)
                .expiresAt(expiresAt)
                .build());
        return new Handoff(code, expiresAt);
    }

    private static String newCode() {
        byte[] bytes = new byte[CODE_BYTES];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    /**
     * Traspaso recién preparado.
     *
     * @param code      valor del código; solo viaja en la cookie
     * @param expiresAt caducidad, para el Max-Age de la cookie
     */
    public record Handoff(String code, Instant expiresAt) {
    }
}
