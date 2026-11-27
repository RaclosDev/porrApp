package app.porrapp.service.notification;

/** Se ha abierto una incidencia de resultado que tiene que revisar el administrador de porrApp. */
public record MatchSyncIncidentOpenedEvent(Long incidentId) {}
