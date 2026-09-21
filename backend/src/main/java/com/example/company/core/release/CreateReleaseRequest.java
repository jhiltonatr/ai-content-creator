package com.example.company.core.release;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateReleaseRequest(
        @NotBlank @Size(max = 255) String name,
        String notes) {
}