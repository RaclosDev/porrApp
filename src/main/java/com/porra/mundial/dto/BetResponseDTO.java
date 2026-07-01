package com.porra.mundial.dto;

import lombok.Builder;
import lombok.Data;

/**
 * DTO para enviar la información de una Apuesta (Bet) al Frontend de React.
 * Contiene metadatos de la apuesta y envuelve a BetDataDTO que tiene la predicción real.
 */
@Data
@Builder
public class BetResponseDTO {
    /** Clave única (usualmente el ID convertido a String) para usar como Key en React. */
    private String key;
    /** Hash SHA-256 de los datos de la apuesta para verificar integridad. */
    private String hash;
    /** Indica si el usuario ya ha pagado su inscripción a la porra. */
    private Boolean paid;
    /** Nombre público del participante que hizo la apuesta. */
    private String participantName;
    /** ID del UserAccount asociado. */
    private Long userId;
    /** Nombre descriptivo de la apuesta. */
    private String betName;
    /** ID del grupo al que pertenece la apuesta (null si es global). */
    private Long groupId;
    /** Estructura con todas las predicciones desglosadas. */
    private BetDataDTO data;
}
