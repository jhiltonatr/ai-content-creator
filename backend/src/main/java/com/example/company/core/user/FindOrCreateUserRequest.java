package com.example.company.core.user;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record FindOrCreateUserRequest(
        @NotBlank @Email String email,
        String displayName) {
}