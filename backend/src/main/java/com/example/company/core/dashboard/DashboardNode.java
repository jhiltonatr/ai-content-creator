package com.example.company.core.dashboard;

import com.example.company.core.domain.NodeKind;
import com.example.company.core.domain.NodeStatus;

import java.time.Instant;

/**
 * One flat row of a story's node listing for the dashboard — every node with the
 * fields the overview needs to render per-book word counts, status, language and
 * recent-edits, resolved to the effective language (override or story default).
 */
public record DashboardNode(long id,
                            Long parentId,
                            NodeKind kind,
                            String title,
                            NodeStatus status,
                            String language,
                            int wordCount,
                            Instant updatedAt,
                            long updatedBy,
                            String updatedByName) {
}