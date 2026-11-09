package app.porrapp.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CustomTeamRequest(@NotBlank @Size(max = 100) String name,
                                @Size(max = 50) String groupName,
                                @Size(max = 500) String logoUrl) {
    public CustomTeamRequest(String name, String groupName) {
        this(name, groupName, null);
    }
}
