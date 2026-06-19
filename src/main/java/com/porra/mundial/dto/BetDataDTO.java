package com.porra.mundial.dto;

import lombok.Data;
import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class BetDataDTO {
    private String user;
    private String bet;
    private Map<String, List<String>> groups;
    private List<String> thirds;
    private List<List<String>> r16;
    private List<List<String>> qf;
    private List<List<String>> sf;
    @com.fasterxml.jackson.annotation.JsonProperty("final")
    private List<String> finalMatch; // Note: 'final' is a reserved word in Java, but Jackson can map it
    private String champion;
    private String thirdPlaceWinner;
    private List<String> thirdPlaceMatch;
    private String scorer;

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
