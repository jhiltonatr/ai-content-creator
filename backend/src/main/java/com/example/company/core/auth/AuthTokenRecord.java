package com.example.company.core.auth;

import java.time.Instant;

public record AuthTokenRecord(long id, long userId, Instant expiresAt) {
}