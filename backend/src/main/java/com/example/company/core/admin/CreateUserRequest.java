package com.example.company.core.admin;

import com.example.company.core.domain.SystemRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateUserRequest(
        @NotBlank @Email String email,
        @NotBlank String displayName,
        @NotBlank @Size(min = 8, message = "password must be at least 8 characters") String password,
        SystemRole systemRole) {
}