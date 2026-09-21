package com.example.company.core.node;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import tools.jackson.databind.JsonNode;

public record PayloadUpdateRequest(
        @NotNull Long expectedVersion,
        @NotBlank String changeId,
        @NotNull JsonNode payload) {
}