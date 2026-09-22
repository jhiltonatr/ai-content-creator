package com.example.company.core.user;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ChangePasswordRequest(
        @NotBlank(message = "current password is required") String currentPassword,
        @NotBlank @Size(min = 8, message = "new password must be at least 8 characters") String newPassword) {
}