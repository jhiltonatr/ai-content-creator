package com.example.company.core.user;

import com.example.company.core.domain.SystemRole;
import tools.jackson.databind.JsonNode;

import java.time.Instant;

/**
 * Account identity plus system ("platform") role and status.
 *
 * <p>This record is never serialized directly: {@code passwordHash} stays internal to the
 * service layer; API responses use {@link MeResponse.UserInfo} or admin view records.
 * {@code settings} is free-form personal preferences (default language, theme, ...) stored
 * as JSONB and interpreted by the service layer.
 */
public record UserRecord(long id,
                         String email,
                         String displayName,
                         boolean enabled,
                         SystemRole systemRole,
                         String passwordHash,
                         Instant createdAt,
                         JsonNode settings) {
}