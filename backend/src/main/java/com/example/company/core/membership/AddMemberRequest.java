package com.example.company.core.membership;

import jakarta.validation.constraints.NotBlank;

public record AddMemberRequest(
        @NotBlank String email,
        String displayName,
        @NotBlank String role) {
}