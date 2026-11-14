package app.porrapp.service.account;

import app.porrapp.exception.BusinessException;
import app.porrapp.dto.MeResponse;
import app.porrapp.model.UserAccount;
import app.porrapp.repository.UserAccountRepository;
import app.porrapp.service.admin.AdminAccess;
import app.porrapp.util.TextSanitizer;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Datos y preferencias del usuario autenticado. */
@Service
@RequiredArgsConstructor
public class UserService {

    private final UserAccountRepository userAccountRepository;
    private final AdminAccess adminAccess;

    @Transactional(readOnly = true)
    public MeResponse getMe(String email) {
        UserAccount user = findUser(email);
        return new MeResponse(user.getId(), TextSanitizer.fixParticipantName(user.getParticipantName()),
                user.getLastSelectedGroupId(), user.getAvatarUrl(), user.isProfileSetupCompleted(),
                adminAccess.isAdmin(email));
    }

    @Transactional
    public void updateLastSelectedGroup(String email, Long groupId) {
        UserAccount user = findUser(email);
        user.setLastSelectedGroupId(groupId);
        userAccountRepository.save(user);
    }

    @Transactional
    public void completeProfileSetup(String email) {
        UserAccount user = findUser(email);
        user.setProfileSetupCompleted(true);
        userAccountRepository.save(user);
    }

    private UserAccount findUser(String email) {
        return userAccountRepository.findByGoogleEmail(email)
                .orElseThrow(() -> BusinessException.notFound("Usuario no encontrado"));
    }
}
