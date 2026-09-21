package com.example.company.core.node;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record UpdateMetadataRequest(
        @NotNull Long expectedVersion,
        String changeId,
        @Size(max = 500) String title,
        String status,
        @Size(max = 16) String language) {
}