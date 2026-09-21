package com.example.company.core.story;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import tools.jackson.databind.JsonNode;

public record UpdateStoryRequest(
        @NotBlank @Size(max = 255) String title,
        @Size(max = 16) String defaultLanguage,
        String synopsis,
        JsonNode settings) {
}