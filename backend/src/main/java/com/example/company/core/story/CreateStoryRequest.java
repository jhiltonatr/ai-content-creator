package com.example.company.core.story;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import tools.jackson.databind.JsonNode;

public record CreateStoryRequest(
        @NotBlank @Size(max = 255) String title,
        @NotBlank String storyType,
        @Size(max = 16) String defaultLanguage,
        String synopsis,
        JsonNode settings) {
}