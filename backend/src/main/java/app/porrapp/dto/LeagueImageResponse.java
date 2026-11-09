package app.porrapp.dto;

import app.porrapp.model.League;

/**
 * Imagen de la liga tras subirla o borrarla.
 *
 * @param status   siempre "success"
 * @param imageUrl URL versionada de la imagen, o null si se ha borrado
 */
public record LeagueImageResponse(String status, String imageUrl) {

    public static LeagueImageResponse of(League league) {
        return new LeagueImageResponse("success", league.getImageUrl());
    }
}
