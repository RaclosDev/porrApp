package com.porra.mundial.dto;

import com.porra.mundial.model.UserAccount;

/**
 * Perfil tras cambiar el apodo o la foto.
 *
 * @param status          siempre "success"
 * @param participantName apodo actual
 * @param avatarUrl       foto de perfil versionada, o null
 */
public record ProfileResponse(String status, String participantName, String avatarUrl) {

    public static ProfileResponse of(UserAccount user) {
        return new ProfileResponse("success", user.getParticipantName(), user.getAvatarUrl());
    }
}
