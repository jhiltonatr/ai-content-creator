package com.example.company.core.character;

import tools.jackson.databind.JsonNode;

import java.time.Instant;

public record CharacterRecord(long id,
                              long storyId,
                              String name,
                              JsonNode attributes,
                              String bio,
                              String notes,
                              Instant createdAt,
                              Instant updatedAt) {
}