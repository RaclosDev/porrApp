package app.porrapp.dto;

import java.util.List;

/** Aviso push del administrador: ligas destinatarias, título y texto. */
public record AdminAnnouncementRequest(List<Long> leagueIds, String title, String body) {
}
