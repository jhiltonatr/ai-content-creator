package com.example.company.core.link;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CreateLinkRequest(
        @NotBlank String fromType,
        @NotNull Long fromId,
        @NotBlank String toType,
        @NotNull Long toId,
        @NotBlank String kind) {
}