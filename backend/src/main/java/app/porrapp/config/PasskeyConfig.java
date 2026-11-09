package app.porrapp.config;

import com.yubico.webauthn.CredentialRepository;
import com.yubico.webauthn.RelyingParty;
import com.yubico.webauthn.data.PublicKeyCredentialParameters;
import com.yubico.webauthn.data.RelyingPartyIdentity;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Llaves de acceso (WebAuthn). Una llave queda ligada al dominio {@code app.webauthn.rp-id} y solo
 * se acepta desde los orígenes de {@code app.webauthn.origins}. En local: {@code WEBAUTHN_RP_ID=localhost}
 * y {@code WEBAUTHN_ORIGINS=http://localhost:5173}.
 */
@Configuration
public class PasskeyConfig {

    @Bean
    public RelyingParty relyingParty(
            CredentialRepository credentialRepository,
            @Value("${app.webauthn.rp-id:porrapp.app}") String rpId,
            @Value("${app.webauthn.origins:https://porrapp.app}") String origins) {
        return RelyingParty.builder()
                .identity(RelyingPartyIdentity.builder().id(rpId).name("porrApp").build())
                .credentialRepository(credentialRepository)
                // Los que usan iPhone, Android, Windows Hello y las llaves físicas; sin los
                // post-cuánticos, que esta JVM aún no sabe verificar.
                .preferredPubkeyParams(List.of(PublicKeyCredentialParameters.ES256,
                        PublicKeyCredentialParameters.EdDSA, PublicKeyCredentialParameters.RS256))
                .origins(Arrays.stream(origins.split(","))
                        .map(String::trim)
                        .filter(origin -> !origin.isEmpty())
                        .collect(Collectors.toSet()))
                .build();
    }
}
