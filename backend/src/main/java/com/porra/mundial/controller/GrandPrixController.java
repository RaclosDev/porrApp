package com.porra.mundial.controller;

import com.porra.mundial.dto.GrandPrixBoardDTO;
import com.porra.mundial.dto.FormulaOneStandingsDTO;
import com.porra.mundial.dto.GrandPrixPickRequest;
import com.porra.mundial.dto.RaceClassificationDTO;
import com.porra.mundial.service.formulaone.FormulaOneStandingsService;
import com.porra.mundial.service.formulaone.GrandPrixService;
import com.porra.mundial.service.notification.WebSocketService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;
import java.util.List;

/** Ligas de Fórmula 1: Grandes Premios, predicción de podio, pole y vuelta rápida, las de la liga y el Mundial. */
@RestController
@RequestMapping("/api/grand-prix")
@RequiredArgsConstructor
public class GrandPrixController {

    private final GrandPrixService grandPrixService;
    private final WebSocketService webSocketService;
    private final FormulaOneStandingsService standingsService;

    @GetMapping
    public GrandPrixBoardDTO board(@RequestParam Long groupId, Principal principal) {
        return grandPrixService.board(CurrentUser.email(principal), groupId);
    }

    /** Mundial de pilotos y de constructores (el mismo para todas las ligas de Fórmula 1). */
    @GetMapping("/standings")
    public FormulaOneStandingsDTO standings(@RequestParam Long groupId, Principal principal) {
        grandPrixService.assertGrandPrixLeague(CurrentUser.email(principal), groupId);
        return standingsService.standings();
    }

    @PutMapping("/{matchId}")
    public GrandPrixBoardDTO savePick(@PathVariable Long matchId, @RequestParam Long groupId,
                                      @RequestBody GrandPrixPickRequest request, Principal principal) {
        GrandPrixBoardDTO board = grandPrixService.savePick(CurrentUser.email(principal), groupId, matchId, request);
        webSocketService.notifyMatchPredictionsSaved(groupId);
        return board;
    }

    /** Clasificación completa de la carrera: puestos, tiempos o diferencias, abandonos y puntos. */
    @GetMapping("/{matchId}/classification")
    public RaceClassificationDTO classification(@PathVariable Long matchId, @RequestParam Long groupId,
                                                Principal principal) {
        return grandPrixService.classification(CurrentUser.email(principal), groupId, matchId);
    }

    @GetMapping("/{matchId}/picks")
    public List<GrandPrixBoardDTO.MemberPick> memberPicks(@PathVariable Long matchId, @RequestParam Long groupId,
                                                          Principal principal) {
        return grandPrixService.memberPicks(CurrentUser.email(principal), groupId, matchId);
    }
}
