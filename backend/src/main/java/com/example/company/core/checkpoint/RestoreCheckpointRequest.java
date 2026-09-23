package com.example.company.core.checkpoint;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RestoreCheckpointRequest(
        long expectedVersion,
        @NotBlank @Size(max = 64) String changeId) {
}