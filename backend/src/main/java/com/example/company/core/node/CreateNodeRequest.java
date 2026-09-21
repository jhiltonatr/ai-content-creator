package com.example.company.core.node;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import tools.jackson.databind.JsonNode;

public record CreateNodeRequest(
        @NotBlank String nodeType,
        @NotBlank @Size(max = 500) String title,
        Long parentId,
        Integer sortOrder,
        @Size(max = 16) String language,
        JsonNode body,
        JsonNode script,
        JsonNode meta) {
}