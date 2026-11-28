package app.porrapp.dto;

import app.porrapp.model.LeaguePlan;
import jakarta.validation.constraints.NotNull;

/** Plan que el panel de administración asigna a una liga y si tiene la música de la TV de póker. */
public record AdminLeaguePlanRequest(@NotNull LeaguePlan plan, boolean pokerMusic) {
}
