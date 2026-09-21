package com.example.company.core.lore;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SaveLoreRequest(
        @NotBlank @Size(max = 255) String title,
        @Size(max = 255) String category,
        String body) {
}