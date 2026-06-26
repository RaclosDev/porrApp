package com.porra.mundial.dto;

import lombok.Data;
import java.util.List;
import java.util.Map;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.NotEmpty;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class BetDataDTO {
    @NotBlank(message = "El nombre de usuario o porra es obligatorio")
    private String user;
    private String bet;
    
    @NotEmpty(message = "Las predicciones de la fase de grupos no pueden estar vacías")
    private Map<String, List<String>> groups;
    private List<String> thirds;
    
    @NotNull(message = "Faltan predicciones de la fase eliminatoria")
    private List<List<String>> r32;
    
    @NotNull(message = "Faltan predicciones de la fase eliminatoria")
    private List<List<String>> r16;
    private List<List<String>> qf;
    private List<List<String>> sf;
    @com.fasterxml.jackson.annotation.JsonProperty("final")
    private List<String> finalMatch; // Note: 'final' is a reserved word in Java, but Jackson can map it
    private String champion;
    private String thirdPlaceWinner;
    private List<String> thirdPlaceMatch;
    private String scorer;

    public List<String> getFlatR32() {
        return flatten(r32);
    }
    public List<String> getFlatR16() {
        return flatten(r16);
    }
    public List<String> getFlatQf() {
        return flatten(qf);
    }
    public List<String> getFlatSf() {
        return flatten(sf);
    }
    private List<String> flatten(List<List<String>> nested) {
        if (nested == null) return java.util.Collections.emptyList();
        return nested.stream().flatMap(List::stream).filter(java.util.Objects::nonNull).collect(java.util.stream.Collectors.toList());
    }
}
