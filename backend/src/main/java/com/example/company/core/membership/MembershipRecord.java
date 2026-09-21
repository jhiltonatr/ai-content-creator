package com.example.company.core.membership;

import com.example.company.core.domain.Role;

import java.time.Instant;

public record MembershipRecord(long id,
                               long storyId,
                               long userId,
                               Role role,
                               Instant createdAt,
                               String email,
                               String displayName) {
}