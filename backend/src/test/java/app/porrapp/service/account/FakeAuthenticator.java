package app.porrapp.service.account;

import com.fasterxml.jackson.dataformat.cbor.CBORFactory;
import com.fasterxml.jackson.dataformat.cbor.CBORGenerator;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigInteger;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.MessageDigest;
import java.security.Signature;
import java.security.interfaces.ECPublicKey;
import java.security.spec.ECGenParameterSpec;
import java.util.Arrays;
import java.util.Base64;

/**
 * Autenticador de pruebas: crea una llave ES256 y responde a los retos como lo haría el navegador,
 * con el JSON que envía el frontend (incluidos campos extra que la librería debe ignorar).
 */
final class FakeAuthenticator {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final Base64.Encoder B64 = Base64.getUrlEncoder().withoutPadding();

    private final String origin;
    private final String rpId;
    private final KeyPair keyPair;
    private final byte[] credentialId = new byte[16];
    private byte[] userHandle;
    private int signCount;

    FakeAuthenticator(String origin, String rpId) throws Exception {
        this.origin = origin;
        this.rpId = rpId;
        KeyPairGenerator generator = KeyPairGenerator.getInstance("EC");
        generator.initialize(new ECGenParameterSpec("secp256r1"));
        this.keyPair = generator.generateKeyPair();
        new java.security.SecureRandom().nextBytes(credentialId);
    }

    /** Respuesta a {@code navigator.credentials.create} para las opciones del servidor. */
    String register(String browserOptionsJson) throws Exception {
        JsonNode publicKey = JSON.readTree(browserOptionsJson).get("publicKey");
        userHandle = Base64.getUrlDecoder().decode(publicKey.get("user").get("id").asText());
        byte[] clientData = clientData("webauthn.create", publicKey.get("challenge").asText());
        byte[] authData = concat(rpIdHash(), new byte[]{0x45}, counter(0),
                new byte[16], ByteBuffer.allocate(2).putShort((short) credentialId.length).array(), credentialId, coseKey());
        byte[] attestationObject = cbor(gen -> {
            gen.writeStartObject();
            gen.writeFieldName("fmt");
            gen.writeString("none");
            gen.writeFieldName("attStmt");
            gen.writeStartObject();
            gen.writeEndObject();
            gen.writeFieldName("authData");
            gen.writeBinary(authData);
            gen.writeEndObject();
        });
        return """
                {"type":"public-key","id":"%1$s","rawId":"%1$s","authenticatorAttachment":"platform",
                 "response":{"clientDataJSON":"%2$s","attestationObject":"%3$s","transports":["internal","hybrid"],
                             "publicKeyAlgorithm":-7},
                 "clientExtensionResults":{}}
                """.formatted(B64.encodeToString(credentialId), B64.encodeToString(clientData),
                B64.encodeToString(attestationObject));
    }

    /** Respuesta a {@code navigator.credentials.get}: firma el reto con la llave creada. */
    String login(String browserOptionsJson) throws Exception {
        JsonNode publicKey = JSON.readTree(browserOptionsJson).get("publicKey");
        byte[] clientData = clientData("webauthn.get", publicKey.get("challenge").asText());
        byte[] authData = concat(rpIdHash(), new byte[]{0x05}, counter(++signCount));
        Signature signer = Signature.getInstance("SHA256withECDSA");
        signer.initSign(keyPair.getPrivate());
        signer.update(concat(authData, MessageDigest.getInstance("SHA-256").digest(clientData)));
        return """
                {"type":"public-key","id":"%1$s","rawId":"%1$s","authenticatorAttachment":"platform",
                 "response":{"clientDataJSON":"%2$s","authenticatorData":"%3$s","signature":"%4$s","userHandle":"%5$s"},
                 "clientExtensionResults":{}}
                """.formatted(B64.encodeToString(credentialId), B64.encodeToString(clientData),
                B64.encodeToString(authData), B64.encodeToString(signer.sign()), B64.encodeToString(userHandle));
    }

    byte[] credentialId() {
        return credentialId.clone();
    }

    private byte[] clientData(String type, String challenge) {
        return ("{\"type\":\"" + type + "\",\"challenge\":\"" + challenge + "\",\"origin\":\"" + origin
                + "\",\"crossOrigin\":false}").getBytes(StandardCharsets.UTF_8);
    }

    private byte[] rpIdHash() throws Exception {
        return MessageDigest.getInstance("SHA-256").digest(rpId.getBytes(StandardCharsets.UTF_8));
    }

    private static byte[] counter(int value) {
        return ByteBuffer.allocate(4).putInt(value).array();
    }

    /** Clave pública EC2 P-256 en COSE: {1: 2, 3: -7, -1: 1, -2: x, -3: y}. */
    private byte[] coseKey() throws IOException {
        ECPublicKey key = (ECPublicKey) keyPair.getPublic();
        byte[] x = unsigned32(key.getW().getAffineX());
        byte[] y = unsigned32(key.getW().getAffineY());
        return cbor(gen -> {
            gen.writeStartObject();
            gen.writeFieldId(1);
            gen.writeNumber(2);
            gen.writeFieldId(3);
            gen.writeNumber(-7);
            gen.writeFieldId(-1);
            gen.writeNumber(1);
            gen.writeFieldId(-2);
            gen.writeBinary(x);
            gen.writeFieldId(-3);
            gen.writeBinary(y);
            gen.writeEndObject();
        });
    }

    private static byte[] unsigned32(BigInteger value) {
        byte[] bytes = value.toByteArray();
        if (bytes.length == 32) {
            return bytes;
        }
        byte[] out = new byte[32];
        int length = Math.min(bytes.length, 32);
        System.arraycopy(bytes, bytes.length - length, out, 32 - length, length);
        return out;
    }

    private interface CborWriter {
        void write(CBORGenerator generator) throws IOException;
    }

    private static byte[] cbor(CborWriter writer) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (CBORGenerator generator = new CBORFactory().createGenerator(out)) {
            writer.write(generator);
        }
        return out.toByteArray();
    }

    private static byte[] concat(byte[]... parts) {
        int length = Arrays.stream(parts).mapToInt(part -> part.length).sum();
        ByteBuffer buffer = ByteBuffer.allocate(length);
        for (byte[] part : parts) {
            buffer.put(part);
        }
        return buffer.array();
    }
}
