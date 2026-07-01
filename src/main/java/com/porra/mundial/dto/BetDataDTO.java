package com.porra.mundial.dto;

import lombok.Data;
import java.util.List;
import java.util.Map;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.NotEmpty;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * DTO (Data Transfer Object) Principal de las Predicciones (Bet).
 * Representa la estructura jerárquica y compleja del JSON que envía el Frontend al guardar una porra.
 * Contiene todas las elecciones del usuario desde la fase de grupos hasta la final.
 */
@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class BetDataDTO {
    
    /** Nombre del participante que hace la apuesta (o email de Google). */
    @NotBlank(message = "El nombre de usuario o porra es obligatorio")
    private String user;
    
    /** Identificador alfanumérico o nombre descriptivo de la apuesta. */
    private String bet;
    
    /** 
     * Predicciones de la Fase de Grupos.
     * Mapa donde la clave es el Grupo ("A", "B") y el valor es la lista ordenada de equipos. 
     */
    @NotEmpty(message = "Las predicciones de la fase de grupos no pueden estar vacías")
    private Map<String, List<String>> groups;
    
    /** Lista de los mejores terceros clasificados (Si el formato del torneo lo requiere como Eurocopa o Mundial 2026). */
    private List<String> thirds;
    
    /** Dieciseisavos de final. Lista de enfrentamientos, donde cada enfrentamiento es una lista de 2 equipos. */
    @NotNull(message = "Faltan predicciones de la fase eliminatoria")
    private List<List<String>> r32;
    
    /** Octavos de final. */
    @NotNull(message = "Faltan predicciones de la fase eliminatoria")
    private List<List<String>> r16;
    
    /** Cuartos de final. */
    private List<List<String>> qf;
    
    /** Semifinales. */
    private List<List<String>> sf;
    
    /** La Gran Final (Lista de 2 equipos). La palabra 'final' es reservada en Java, por lo que usamos finalMatch mapeada con @JsonProperty. */
    @com.fasterxml.jackson.annotation.JsonProperty("final")
    private List<String> finalMatch; 
    
    /** Equipo Campeón del Torneo. */
    private String champion;
    
    /** Ganador del tercer puesto. */
    private String thirdPlaceWinner;
    
    /** Partido por el tercer y cuarto puesto. */
    private List<String> thirdPlaceMatch;
    
    /** Jugador máximo goleador predicho (Pichichi). */
    private String scorer;

    /**
     * @return Lista plana de todos los equipos presentes en dieciseisavos de final.
     */
    public List<String> getFlatR32() {
        return flatten(r32);
    }
    
    /**
     * @return Lista plana de todos los equipos presentes en octavos de final.
     */
    public List<String> getFlatR16() {
        return flatten(r16);
    }
    
    /**
     * @return Lista plana de todos los equipos presentes en cuartos de final.
     */
    public List<String> getFlatQf() {
        return flatten(qf);
    }
    
    /**
     * @return Lista plana de todos los equipos presentes en semifinales.
     */
    public List<String> getFlatSf() {
        return flatten(sf);
    }
    
    /**
     * Método auxiliar de utilidad para aplanar (flatten) listas anidadas de emparejamientos
     * a una única lista plana de nombres de equipos. Facilita las comprobaciones lógicas.
     */
    private List<String> flatten(List<List<String>> nested) {
        if (nested == null) return java.util.Collections.emptyList();
        return nested.stream().flatMap(List::stream).filter(java.util.Objects::nonNull).collect(java.util.stream.Collectors.toList());
    }
}
