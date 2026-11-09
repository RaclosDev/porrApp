package app.porrapp.service.account;

import app.porrapp.exception.BusinessException;
import app.porrapp.model.League;
import app.porrapp.model.LeagueImage;
import app.porrapp.model.UserAccount;
import app.porrapp.model.UserAvatar;
import app.porrapp.repository.LeagueImageRepository;
import app.porrapp.repository.LeagueRepository;
import app.porrapp.repository.UserAccountRepository;
import app.porrapp.repository.UserAvatarRepository;
import app.porrapp.util.ImageKeys;
import app.porrapp.util.ImageProcessor;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.time.Instant;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * Gestión de imágenes de liga, fotos de perfil y nombre público del usuario.
 *
 * <p>Reglas de autorización:
 * <ul>
 *   <li>La imagen de una liga solo puede cambiarla o borrarla el administrador de esa liga.</li>
 *   <li>El perfil (nombre y foto) siempre se resuelve a partir del email autenticado: no existe
 *       ningún parámetro con el que un usuario pueda apuntar al perfil de otro.</li>
 *   <li>El email y el nombre de Google no se tocan nunca.</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
public class ProfileImageService {

    static final int NAME_MIN = 2;
    static final int NAME_MAX = 30;
    private static final Pattern NAME_PATTERN = Pattern.compile("^[\\p{L}\\p{N}][\\p{L}\\p{N}\\p{M} ._'’-]*$");

    private final LeagueRepository leagueRepository;
    private final LeagueImageRepository leagueImageRepository;
    private final UserAccountRepository userAccountRepository;
    private final UserAvatarRepository userAvatarRepository;

    /** Imagen lista para servir. */
    public record StoredImage(byte[] data, String contentType, Instant updatedAt) {
    }

    // Ligas

    @Transactional
    public League saveLeagueImage(Long groupId, String email, byte[] raw) {
        League league = requireLeagueAdmin(groupId, email);
        ImageProcessor.ProcessedImage image = ImageProcessor.process(raw);
        Instant now = Instant.now();

        LeagueImage leagueImage = leagueImageRepository.findById(league.getId())
                .orElseGet(() -> LeagueImage.builder().leagueId(league.getId()).build());
        leagueImage.setContentType(image.contentType());
        leagueImage.setData(image.data());
        leagueImage.setSizeBytes(image.data().length);
        leagueImage.setUpdatedAt(now);
        leagueImageRepository.save(leagueImage);
        league.setImageUpdatedAt(now);
        league.setImageKey(ImageKeys.newKey());
        return leagueRepository.save(league);
    }

    @Transactional
    public League deleteLeagueImage(Long groupId, String email) {
        League league = requireLeagueAdmin(groupId, email);
        if (leagueImageRepository.existsById(league.getId())) {
            leagueImageRepository.deleteById(league.getId());
        }
        league.setImageUpdatedAt(null);
        league.setImageKey(null);
        return leagueRepository.save(league);
    }

    /** Uso interno del servidor (vista previa de una invitación); no comprueba la clave. */
    @Transactional(readOnly = true)
    public Optional<StoredImage> getLeagueImage(Long groupId) {
        return leagueImageRepository.findById(groupId)
                .map(i -> new StoredImage(i.getData(), i.getContentType(), i.getUpdatedAt()));
    }

    @Transactional(readOnly = true)
    public Optional<StoredImage> getLeagueImage(Long groupId, String key) {
        boolean keyOk = leagueRepository.findById(groupId)
                .map(l -> l.getImageUpdatedAt() != null && ImageKeys.matches(l.getImageKey(), key))
                .orElse(false);
        if (!keyOk) return Optional.empty();
        return leagueImageRepository.findById(groupId)
                .map(i -> new StoredImage(i.getData(), i.getContentType(), i.getUpdatedAt()));
    }

    private League requireLeagueAdmin(Long groupId, String email) {
        League league = leagueRepository.findById(groupId)
                .orElseThrow(() -> BusinessException.notFound("Liga no encontrada"));
        UserAccount admin = league.getAdminUser();
        if (email == null || admin == null || admin.getGoogleEmail() == null
                || !admin.getGoogleEmail().equalsIgnoreCase(email)) {
            throw BusinessException.forbidden("Solo el administrador de la liga puede cambiar su imagen.");
        }
        return league;
    }

    // Perfil

    @Transactional
    public UserAccount saveAvatar(String email, byte[] raw) {
        UserAccount user = requireUser(email);
        ImageProcessor.ProcessedImage image = ImageProcessor.process(raw);
        Instant now = Instant.now();

        UserAvatar avatar = userAvatarRepository.findById(user.getId())
                .orElseGet(() -> UserAvatar.builder().userId(user.getId()).build());
        avatar.setContentType(image.contentType());
        avatar.setData(image.data());
        avatar.setSizeBytes(image.data().length);
        avatar.setUpdatedAt(now);
        userAvatarRepository.save(avatar);
        user.setAvatarUpdatedAt(now);
        user.setAvatarKey(ImageKeys.newKey());
        return userAccountRepository.save(user);
    }

    @Transactional
    public UserAccount deleteAvatar(String email) {
        UserAccount user = requireUser(email);
        if (userAvatarRepository.existsById(user.getId())) {
            userAvatarRepository.deleteById(user.getId());
        }
        user.setAvatarUpdatedAt(null);
        user.setAvatarKey(null);
        return userAccountRepository.save(user);
    }

    @Transactional(readOnly = true)
    public Optional<StoredImage> getAvatar(Long userId, String key) {
        boolean keyOk = userAccountRepository.findById(userId)
                .map(u -> u.getAvatarUpdatedAt() != null && ImageKeys.matches(u.getAvatarKey(), key))
                .orElse(false);
        if (!keyOk) return Optional.empty();
        return userAvatarRepository.findById(userId)
                .map(a -> new StoredImage(a.getData(), a.getContentType(), a.getUpdatedAt()));
    }

    /**
     * Cambia únicamente el nombre público (participantName) del usuario autenticado.
     * Los datos de identidad de Google (email y nombre) y la vinculación de la cuenta no se modifican.
     */
    @Transactional
    public UserAccount updateParticipantName(String email, String rawName) {
        UserAccount user = requireUser(email);
        String name = normalizeParticipantName(rawName);

        if (name.equals(user.getParticipantName())) {
            return user;
        }
        if (userAccountRepository.existsByParticipantNameIgnoreCaseAndIdNot(name, user.getId())) {
            throw BusinessException.conflict("Ese nombre ya está en uso. Elige otro.");
        }
        user.setParticipantName(name);
        return userAccountRepository.save(user);
    }

    /** Normaliza y valida el nombre público. Lanza BusinessException si no es válido. */
    static String normalizeParticipantName(String rawName) {
        if (rawName == null) {
            throw BusinessException.badRequest("El nombre es obligatorio.");
        }
        String name = Normalizer.normalize(rawName, Normalizer.Form.NFC).trim().replaceAll("\\s+", " ");
        if (name.length() < NAME_MIN || name.length() > NAME_MAX) {
            throw BusinessException.badRequest(
                    "El nombre debe tener entre " + NAME_MIN + " y " + NAME_MAX + " caracteres.");
        }
        if (!NAME_PATTERN.matcher(name).matches()) {
            throw BusinessException.badRequest(
                    "El nombre solo puede contener letras, números, espacios y los símbolos . _ ' -");
        }
        // "Admin" está reservado: es el nombre de la cuenta interna del sistema.
        if (name.toLowerCase(Locale.ROOT).equals("admin")) {
            throw BusinessException.badRequest("Ese nombre no está disponible.");
        }
        return name;
    }

    private UserAccount requireUser(String email) {
        if (email == null || email.isBlank()) {
            throw BusinessException.forbidden("No autorizado");
        }
        return userAccountRepository.findByGoogleEmail(email)
                .orElseThrow(() -> BusinessException.notFound("Usuario no encontrado"));
    }
}
