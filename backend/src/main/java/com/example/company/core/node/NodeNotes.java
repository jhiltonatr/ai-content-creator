package com.example.company.core.node;

/**
 * The writer's private per-node scratchpad. Lives inside {@code meta.notes} (JSONB) so it rides
 * the node's own versioning/concurrency/checkpoint flow for free, and is stripped from release
 * snapshots so it never reaches the published face.
 */
public record NodeNotes(String note) {
}