package app.porrapp.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import java.util.UUID;

public record PushDeviceStateRequest(
        @NotNull UUID deviceId,
        @NotNull @Pattern(regexp = "default|granted|denied|unsupported") String permission,
        boolean installRequired, boolean promptShown) {
}
