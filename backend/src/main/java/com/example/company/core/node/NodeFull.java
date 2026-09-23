package com.example.company.core.node;

import com.example.company.core.domain.NodeKind;
import com.example.company.core.domain.NodeStatus;
import tools.jackson.databind.JsonNode;

import java.time.Instant;

public record NodeFull(long id,
                       long storyId,
                       Long parentId,
                       NodeKind kind,
                       String title,
                       int sortOrder,
                       String language,
                       NodeStatus status,
                       JsonNode body,
                       JsonNode script,
                       JsonNode meta,
                       long version,
                       String lastChangeId,
                       Instant createdAt,
                       Instant updatedAt,
                       long updatedBy,
                       int wordCount) {
}