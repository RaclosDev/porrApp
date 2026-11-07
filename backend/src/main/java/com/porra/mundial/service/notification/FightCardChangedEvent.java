package com.porra.mundial.service.notification;

import java.util.List;

/**
 * Peleas de la UFC canceladas o con cambio de rival cuyas predicciones se han anulado: se avisa a quien
 * las había hecho.
 */
public record FightCardChangedEvent(List<Notice> notices) {

    /** Aviso para un usuario sobre una pelea de una de sus ligas. */
    public record Notice(Long userId, Long leagueId, String leagueName, String title, String body) {}
}
