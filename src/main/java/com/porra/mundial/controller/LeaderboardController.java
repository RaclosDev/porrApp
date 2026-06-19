package com.porra.mundial.controller;

import com.porra.mundial.dto.ParticipantScoreDTO;
import com.porra.mundial.service.LeaderboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/leaderboard")
@RequiredArgsConstructor
public class LeaderboardController {

    private final LeaderboardService leaderboardService;

    @GetMapping
    public ResponseEntity<List<ParticipantScoreDTO>> getLeaderboard(@RequestParam(required = false, defaultValue = "1") Long groupId) {
        return ResponseEntity.ok(leaderboardService.getLeaderboard(groupId));
    }
}
