package com.example.company.core.link;

import com.example.company.core.domain.EntityType;
import com.example.company.core.domain.LinkKind;

import java.time.Instant;

public record LinkRecord(long id,
                         long storyId,
                         EntityType fromType,
                         long fromId,
                         EntityType toType,
                         long toId,
                         LinkKind kind,
                         Instant createdAt) {
}