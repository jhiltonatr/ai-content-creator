package com.example.company.core.checkpoint;

import java.time.Instant;

/**
 * Timeline entry for a node — the lightweight shape the editor history needs
 * without shipping every payload down the list call.
 */
public record CheckpointSummary(long id,
                                long nodeVersion,
                                String note,
                                long createdBy,
                                String authorName,
                                Instant createdAt,
                                int wordCount) {

    public static CheckpointSummary from(CheckpointRecord record) {
        return new CheckpointSummary(record.id(), record.nodeVersion(), record.note(), record.createdBy(),
                record.authorName(), record.createdAt(), record.wordCount());
    }
}