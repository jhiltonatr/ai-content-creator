package com.example.company.core.node;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record SaveNotesRequest(
        @NotNull Long expectedVersion,
        @NotBlank String changeId,
        @Size(max = 50000) String note) {
}