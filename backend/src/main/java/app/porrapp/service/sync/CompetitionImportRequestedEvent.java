package app.porrapp.service.sync;

/**
 * Se ha creado la primera liga de una competición que todavía no tiene equipos ni partidos.
 *
 * @param competitionId competición que hay que importar del proveedor deportivo
 */
public record CompetitionImportRequestedEvent(Long competitionId) {
}
