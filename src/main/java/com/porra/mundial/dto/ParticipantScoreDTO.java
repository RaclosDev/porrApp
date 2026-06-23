package com.porra.mundial.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
@Builder
public class ParticipantScoreDTO {
    private Long id;
    private Long userId;
    private String name;
    private String betName;
    private List<String> thirdPlaceMatch;
    private String thirdPlaceWinner;
    private int r1;
    private int r32;
    private int r16;
    private int qf;
    private int sf;
    private int finals;
    private int scorer;
    private int total;
    private List<LogEntry> log;
    private Map<String, Object> exactMatches;
    private Map<String, Boolean> passedTeams;
    private boolean pending;

    @Data
    @Builder
    public static class LogEntry {
        private String stage;
        private int amount;
        private String msg;
    }
}
