package app.porrapp.controller;

import app.porrapp.dto.PokerDTO.AddTrack;
import app.porrapp.dto.PokerDTO.MusicQueue;
import app.porrapp.dto.PokerDTO.MusicSearch;
import app.porrapp.service.league.PokerMusicService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;

@RestController
@RequestMapping("/api/poker/{id}/music")
@RequiredArgsConstructor
public class PokerMusicController {
    private final PokerMusicService service;

    @GetMapping
    public MusicQueue queue(Principal principal, @PathVariable Long id) {
        return service.queue(principal.getName(), id);
    }

    @GetMapping("/search")
    public MusicSearch search(Principal principal, @PathVariable Long id, @RequestParam("q") String query) {
        return service.search(principal.getName(), id, query);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public MusicQueue add(Principal principal, @PathVariable Long id, @Valid @RequestBody AddTrack request) {
        return service.add(principal.getName(), id, request);
    }

    @DeleteMapping("/{itemId}")
    public MusicQueue remove(Principal principal, @PathVariable Long id, @PathVariable Long itemId) {
        return service.remove(principal.getName(), id, itemId);
    }
}
