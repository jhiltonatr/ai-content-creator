package com.example.company.core.user;

import jakarta.validation.constraints.Email;

public record UpdateProfileRequest(
        @Email String email,
        String displayName) {
}