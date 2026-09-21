package com.example.company.core.character;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import tools.jackson.databind.JsonNode;

public record SaveCharacterRequest(
        @NotBlank @Size(max = 255) String name,
        JsonNode attributes,
        String bio,
        String notes) {
}