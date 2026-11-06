package com.porra.mundial.controller;

import com.porra.mundial.dto.MatchdayPointsDTO;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import com.porra.mundial.dto.ParticipantScoreDTO;
import com.porra.mundial.service.LeagueService;
import com.porra.mundial.service.LeaderboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/leaderboard")
@RequiredArgsConstructor
public class LeaderboardController {

    private final LeaderboardService leaderboardService;
    private final LeagueService leagueService;

    /**
     * Clasificación de una liga, sin el desglose de cada pronóstico (se pide con
     * {@code /api/predictions/{id}/score}). Usa los puntos guardados y recalcula si alguna porra
     * está invalidada. El navegador revalida con ETag y recibe 304 si no ha cambiado.
     */
    @GetMapping
    public ResponseEntity<List<ParticipantScoreDTO>> getLeaderboard(@RequestParam Long groupId, Principal principal) {
        leagueService.assertCanView(groupId, CurrentUser.email(principal));
        List<ParticipantScoreDTO> rows = leaderboardService.getLeaderboard(groupId).stream()
                .map(ParticipantScoreDTO::withoutBreakdown)
                .toList();
        return revalidated(rows);
    }

    /**
     * Registro de puntos de cada pronóstico de la liga (id del pronóstico -> entradas). Solo lo pide
     * la gráfica de evolución por partidos.
     */
    @GetMapping("/logs")
    public ResponseEntity<Map<Long, List<ParticipantScoreDTO.LogEntry>>> getLeaderboardLogs(
            @RequestParam Long groupId, Principal principal) {
        leagueService.assertCanView(groupId, CurrentUser.email(principal));
        Map<Long, List<ParticipantScoreDTO.LogEntry>> logs = new LinkedHashMap<>();
        for (ParticipantScoreDTO row : leaderboardService.getLeaderboard(groupId)) {
            if (row.getId() != null) {
                logs.put(row.getId(), row.getLog() != null ? row.getLog() : List.of());
            }
        }
        return revalidated(logs);
    }

    /**
     * Devuelve los puntos de cada participante desglosados por jornada.
     * Permite navegar por jornadas en el ranking sin descargar el detalle completo de cada porra.
     */
    @GetMapping("/matchdays")
    public ResponseEntity<List<MatchdayPointsDTO>> getMatchdayBreakdown(@RequestParam Long groupId, Principal principal) {
        leagueService.assertCanView(groupId, CurrentUser.email(principal));
        return revalidated(leaderboardService.getMatchdayBreakdown(groupId));
    }

    /**
     * Sin caché local: la clasificación cambia con cada gol y la web la vuelve a pedir al recibir el
     * aviso por WebSocket. El ETag (ShallowEtagHeaderFilter) evita reenviar el cuerpo si no cambió.
     */
    private static <T> ResponseEntity<T> revalidated(T body) {
        return ResponseEntity.ok().cacheControl(CacheControl.noCache().cachePrivate()).body(body);
    }
}
