package com.example.company.core.lore;

import java.time.Instant;

public record LoreRecord(long id,
                         long storyId,
                         String title,
                         String category,
                         String body,
                         Instant createdAt,
                         Instant updatedAt) {
}