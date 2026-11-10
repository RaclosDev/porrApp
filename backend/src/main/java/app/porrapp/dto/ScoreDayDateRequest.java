package app.porrapp.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PastOrPresent;

import java.time.LocalDate;

/** El día en que se jugó de verdad un día de juego apuntado más tarde. */
public record ScoreDayDateRequest(@NotNull @PastOrPresent LocalDate date) {
}
