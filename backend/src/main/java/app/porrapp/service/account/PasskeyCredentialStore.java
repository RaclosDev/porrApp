package app.porrapp.service.account;

import app.porrapp.model.Passkey;
import app.porrapp.repository.PasskeyRepository;
import app.porrapp.repository.UserAccountRepository;
import com.yubico.webauthn.CredentialRepository;
import com.yubico.webauthn.RegisteredCredential;
import com.yubico.webauthn.data.ByteArray;
import com.yubico.webauthn.data.PublicKeyCredentialDescriptor;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Acceso de la librería WebAuthn a las llaves guardadas. El «username» de WebAuthn es el email de
 * Google de la cuenta, el mismo identificador que usa el resto de la API.
 */
@Component
@RequiredArgsConstructor
public class PasskeyCredentialStore implements CredentialRepository {

    private final PasskeyRepository passkeyRepository;
    private final UserAccountRepository userAccountRepository;

    @Override
    public Set<PublicKeyCredentialDescriptor> getCredentialIdsForUsername(String email) {
        return userAccountRepository.findByGoogleEmail(email)
                .map(user -> passkeyRepository.findCredentialIdsByUserId(user.getId()).stream()
                        .map(id -> PublicKeyCredentialDescriptor.builder().id(new ByteArray(id)).build())
                        .collect(Collectors.toSet()))
                .orElse(Set.of());
    }

    @Override
    public Optional<ByteArray> getUserHandleForUsername(String email) {
        return userAccountRepository.findByGoogleEmail(email)
                .flatMap(user -> passkeyRepository.findFirstByUserId(user.getId()))
                .map(passkey -> new ByteArray(passkey.getUserHandle()));
    }

    @Override
    public Optional<String> getUsernameForUserHandle(ByteArray userHandle) {
        return passkeyRepository.findFirstByUserHandle(userHandle.getBytes())
                .flatMap(passkey -> userAccountRepository.findById(passkey.getUserId()))
                .map(user -> user.getGoogleEmail());
    }

    @Override
    public Optional<RegisteredCredential> lookup(ByteArray credentialId, ByteArray userHandle) {
        return passkeyRepository.findByCredentialId(credentialId.getBytes())
                .filter(passkey -> Arrays.equals(passkey.getUserHandle(), userHandle.getBytes()))
                .map(PasskeyCredentialStore::toRegistered);
    }

    @Override
    public Set<RegisteredCredential> lookupAll(ByteArray credentialId) {
        return passkeyRepository.findByCredentialId(credentialId.getBytes())
                .map(PasskeyCredentialStore::toRegistered)
                .map(Set::of)
                .orElse(Set.of());
    }

    private static RegisteredCredential toRegistered(Passkey passkey) {
        return RegisteredCredential.builder()
                .credentialId(new ByteArray(passkey.getCredentialId()))
                .userHandle(new ByteArray(passkey.getUserHandle()))
                .publicKeyCose(new ByteArray(passkey.getPublicKeyCose()))
                .signatureCount(passkey.getSignatureCount())
                .build();
    }
}
