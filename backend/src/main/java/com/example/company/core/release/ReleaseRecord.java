package com.example.company.core.release;

import tools.jackson.databind.JsonNode;

import java.time.Instant;

public record ReleaseRecord(long id,
                            long storyId,
                            int version,
                            String name,
                            String notes,
                            long createdBy,
                            Instant publishedAt,
                            JsonNode nodes) {
}