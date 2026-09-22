package com.example.company.core.admin;

import com.example.company.core.domain.SystemRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateUserRequest(
        @Email String email,
        String displayName,
        SystemRole systemRole,
        Boolean enabled) {
}