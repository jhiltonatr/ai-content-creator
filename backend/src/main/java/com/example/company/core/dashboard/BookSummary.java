package com.example.company.core.dashboard;

import java.util.List;

/**
 * Roll-up of one root node (a book, act, or episode) plus its full subtree in tree
 * order. {@code wordCount}, {@code nodeCount}/{@code draftCount}/{@code doneCount}
 * aggregate the whole subtree — the per-book picture a novelist scans before opening
 * a chapter; {@code nodes} is every descendant so the overview can show per-node
 * status and language overrides at any depth.
 */
public record BookSummary(DashboardNode node,
                          long wordCount,
                          long nodeCount,
                          long draftCount,
                          long doneCount,
                          List<DashboardNode> nodes) {
}