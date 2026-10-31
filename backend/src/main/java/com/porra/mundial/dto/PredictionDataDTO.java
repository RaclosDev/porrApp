package com.porra.mundial.dto;

import lombok.Data;
import java.util.List;
import java.util.Map;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class PredictionDataDTO {
    /** Absent/1 preserves historical brackets; 2 follows the FIFA 2026 draw topology. */
    private Integer topologyVersion;
    
    @NotBlank(message = "El nombre de usuario o porra es obligatorio")
    private String user;
    
    // "bet" se mantiene para leer pronósticos guardados antes del renombrado a "prediction".
    @JsonAlias({"bet", "predictionName", "name"})
    private String prediction;
    
    private Map<String, List<String>> groups;
    
    private List<String> thirds;
    
    @JsonProperty("r32")
    @JsonAlias({"r1", "r32", "r_32"})
    private List<List<String>> r32;
    
    @NotNull(message = "Faltan predicciones de la fase eliminatoria")
    private List<List<String>> r16;
    
    private List<List<String>> qf;
    private List<List<String>> sf;
    
    @JsonProperty("final")
    @JsonAlias({"finalMatch", "final_match", "final"})
    private List<String> finalMatch; 
    
    private String champion;
    private String thirdPlaceWinner;

    @JsonProperty("thirdPlaceMatch")
    @JsonAlias({"thirdPlaceMatch", "third_place_match", "thirdMatch", "third"})
    private List<String> thirdPlaceMatch;
    private String scorer;

    @JsonProperty("final")
    public List<String> getFinalMatch() {
        return finalMatch;
    }

    @JsonProperty("final")
    @JsonAlias({"finalMatch", "final_match", "final"})
    public void setFinalMatch(List<String> finalMatch) {
        this.finalMatch = finalMatch;
    }

    @JsonProperty("r32")
    public List<List<String>> getR32() {
        return r32;
    }

    @JsonProperty("r32")
    @JsonAlias({"r1", "r32", "r_32"})
    public void setR32(List<List<String>> r32) {
        this.r32 = r32;
    }

    @JsonProperty("r1")
    public List<List<String>> getR1() {
        return r32;
    }

    @JsonProperty("r1")
    public void setR1(List<List<String>> r1) {
        if (this.r32 == null) {
            this.r32 = r1;
        }
    }

    @com.fasterxml.jackson.annotation.JsonIgnore
    public List<String> getFlatR32() {
        return flatten(r32);
    }
    
    @com.fasterxml.jackson.annotation.JsonIgnore
    public List<String> getFlatR16() {
        return flatten(r16);
    }
    
    @com.fasterxml.jackson.annotation.JsonIgnore
    public List<String> getFlatQf() {
        return flatten(qf);
    }
    
    @com.fasterxml.jackson.annotation.JsonIgnore
    public List<String> getFlatSf() {
        return flatten(sf);
    }
    
    private List<String> flatten(List<List<String>> nested) {
        if (nested == null) return java.util.Collections.emptyList();
        return nested.stream().flatMap(List::stream).filter(java.util.Objects::nonNull).collect(java.util.stream.Collectors.toList());
    }
}
