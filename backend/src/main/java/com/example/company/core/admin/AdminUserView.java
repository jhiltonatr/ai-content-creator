package com.example.company.core.admin;

import com.example.company.core.domain.SystemRole;

import java.time.Instant;

public record AdminUserView(long id,
                            String email,
                            String displayName,
                            SystemRole systemRole,
                            boolean enabled,
                            Instant createdAt) {
}