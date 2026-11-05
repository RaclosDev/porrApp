package com.porra.mundial.dto;

/**
 * Pronóstico recién guardado.
 *
 * @param id              id del pronóstico
 * @param participantName nombre del participante (solo al crear)
 * @param groupId         liga a la que pertenece (solo al crear)
 * @param status          "creada_con_exito" o "actualizada_con_exito"
 */
@com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL)
public record PredictionSavedResponse(Long id, String participantName, String groupId, String status) {

    public static PredictionSavedResponse created(Long id, String participantName, Long groupId) {
        return new PredictionSavedResponse(id, participantName != null ? participantName : "",
                groupId != null ? groupId.toString() : "", "creada_con_exito");
    }
}
