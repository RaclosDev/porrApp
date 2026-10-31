package com.porra.mundial.dto;

import com.porra.mundial.model.Competition;
import com.porra.mundial.model.Edition;
import com.porra.mundial.model.League;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import tools.jackson.databind.annotation.JsonSerialize;

/**
 * DTO para la respuesta de un Grupo.
 * Contiene la información pública/básica de un grupo, junto con
 * detalles de la edición activa para que el Frontend sepa qué reglas aplicar.
 */
@Data
@Builder
public class GroupResponseDTO {
    private Long id;
    private String name;
    private String joinCode;
    /** Nombre del participante que es administrador de este grupo. */
    private String adminParticipantName;
    private Long adminUserId;
    private LocalDateTime createdAt;
    
    /** Identificador de la competición asociada a la edición activa. */
    private Long competitionId;
    /** Nombre de la competición actual en curso (Ej: Euro 2024, LaLiga). */
    private String competitionName;
    /** Formato de competición física: "LEAGUE" o "TOURNAMENT". */
    private String formatType;
    /** Formato de porra / modalidad (FULL_BRACKET, KNOCKOUTS_ONLY, MATCH_DAY). */
    private String poolFormat;
    /** Si esta edición cuenta con un premio/ranking al pichichi. */
    private Boolean pichichi;
    /** Fecha y hora límite para enviar pronósticos en esta edición. */
    @JsonSerialize(using = MadridDateTimeSerializer.class)
    private LocalDateTime lockDate;
    /** Si la edición se encuentra cerrada para nuevos pronósticos o cambios. */
    private Boolean isLocked;
    /** Reglas personalizadas de la liga. */
    private String rules;
    /** URL (versionada) de la imagen de la liga, o null si no tiene. */
    private String imageUrl;

    /**
     * Vista completa de una liga con los datos de su edición activa.
     *
     * @param edition         edición activa, o null si la liga no tiene
     * @param includeJoinCode solo los miembros ven el código de invitación
     */
    public static GroupResponseDTO of(League league, Edition edition, boolean includeJoinCode) {
        GroupResponseDTOBuilder builder = builder()
                .id(league.getId())
                .name(league.getName())
                .joinCode(includeJoinCode ? league.getJoinCode() : null)
                .adminParticipantName(league.getAdminParticipantName())
                .adminUserId(league.getAdminUserId())
                .createdAt(league.getCreatedAt())
                .rules(league.getRules())
                .imageUrl(league.getImageUrl())
                .isLocked(edition != null && edition.isLocked());
        if (edition != null) {
            withEdition(builder, edition)
                    .lockDate(edition.getLockDate());
        }
        return builder.build();
    }

    /** Vista pública para la previsualización de una invitación: sin administrador, reglas ni código. */
    public static GroupResponseDTO preview(League league, Edition edition) {
        GroupResponseDTOBuilder builder = builder()
                .id(league.getId())
                .name(league.getName())
                .imageUrl(league.getImageUrl());
        if (edition != null) {
            withEdition(builder, edition);
        }
        return builder.build();
    }

    private static GroupResponseDTOBuilder withEdition(GroupResponseDTOBuilder builder, Edition edition) {
        Competition competition = edition.getCompetition();
        return builder
                .competitionId(competition != null ? competition.getId() : null)
                .competitionName(competition != null ? competition.getName() : null)
                .formatType(competition != null ? competition.getFormatType() : null)
                .poolFormat(edition.getPoolFormat() != null ? edition.getPoolFormat().name() : null)
                .pichichi(edition.isPichichi());
    }
}
