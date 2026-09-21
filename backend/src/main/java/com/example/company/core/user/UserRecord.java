package com.example.company.core.user;

import java.time.Instant;

public record UserRecord(long id, String email, String displayName, Instant createdAt) {
}