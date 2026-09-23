package com.example.company.core.checkpoint;

import tools.jackson.databind.JsonNode;

import java.time.Instant;

public record CheckpointRecord(long id,
                               long nodeId,
                               long nodeVersion,
                               String title,
                               JsonNode body,
                               JsonNode script,
                               JsonNode meta,
                               String note,
                               long createdBy,
                               String authorName,
                               Instant createdAt,
                               int wordCount) {
}