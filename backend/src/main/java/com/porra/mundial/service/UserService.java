package com.porra.mundial.service;

import com.porra.mundial.dto.MeResponse;
import com.porra.mundial.model.UserAccount;
import com.porra.mundial.repository.UserAccountRepository;
import com.porra.mundial.util.TextSanitizer;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.NoSuchElementException;

/** Datos y preferencias del usuario autenticado. */
@Service
@RequiredArgsConstructor
public class UserService {

    private final UserAccountRepository userAccountRepository;

    @Transactional(readOnly = true)
    public MeResponse getMe(String email) {
        UserAccount user = findUser(email);
        return new MeResponse(user.getId(), TextSanitizer.fixParticipantName(user.getParticipantName()),
                user.getLastSelectedGroupId(), user.getAvatarUrl());
    }

    @Transactional
    public void updateLastSelectedGroup(String email, Long groupId) {
        UserAccount user = findUser(email);
        user.setLastSelectedGroupId(groupId);
        userAccountRepository.save(user);
    }

    /** Los tokens antiguos identifican al usuario por su apodo en vez de por su email. */
    private UserAccount findUser(String email) {
        return userAccountRepository.findByGoogleEmail(email)
                .or(() -> userAccountRepository.findByParticipantNameIgnoreCase(email))
                .orElseThrow(() -> new NoSuchElementException("Usuario no encontrado"));
    }
}
