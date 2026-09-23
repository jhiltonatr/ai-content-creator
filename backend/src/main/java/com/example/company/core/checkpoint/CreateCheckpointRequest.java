package com.example.company.core.checkpoint;

import jakarta.validation.constraints.Size;

public record CreateCheckpointRequest(
        @Size(max = 500) String note) {
}