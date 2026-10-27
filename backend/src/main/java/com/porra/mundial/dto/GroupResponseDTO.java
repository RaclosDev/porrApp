package com.porra.mundial.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * DTO para la respuesta de un Grupo.
 * Contiene la información pública/básica de un grupo, junto con
 * detalles de la edición activa para que el Frontend sepa qué reglas aplicar.
 */
@Data
@Builder
public class GroupResponseDTO {
    /** Identificador único del grupo. */
    private Long id;
    /** Nombre del grupo. */
    private String name;
    /** Código de invitación necesario para unirse. */
    private String joinCode;
    /** Nombre del participante que es administrador de este grupo. */
    private String adminParticipantName;
    /** Identificador del usuario administrador del grupo. */
    private Long adminUserId;
    /** Fecha de creación del grupo. */
    private LocalDateTime createdAt;
    
    /** Identificador de la competición asociada a la edición activa. */
    private Long competitionId;
    /** Nombre de la competición actual en curso (Ej: Euro 2024, LaLiga). */
    private String competitionName;
    /** Formato de competición física: "LEAGUE" o "TOURNAMENT". */
    private String formatType;
    /** Formato de porra (legacy). */
    private String betMode;
    /** Formato de porra / modalidad (FULL_BRACKET, KNOCKOUTS_ONLY, MATCH_DAY). */
    private String poolFormat;
    /** Si esta edición cuenta con un premio/ranking al pichichi. */
    private Boolean pichichi;
    /** Fecha y hora límite para enviar pronósticos en esta edición. */
    private LocalDateTime lockDate;
    /** Si la edición se encuentra cerrada para nuevos pronósticos o cambios. */
    private Boolean isLocked;
    /** Imagen de portada de la liga. */
    private String imageData;
    /** Reglas personalizadas de la liga. */
    private String rules;
}
