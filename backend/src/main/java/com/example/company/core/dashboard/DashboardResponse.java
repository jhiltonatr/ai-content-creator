package com.example.company.core.dashboard;

import com.example.company.core.domain.StoryType;

import java.time.Instant;
import java.util.List;

/**
 * The project-level "ten-foot view": story context, whole-story aggregates,
 * per-book word counts and status roll-ups, recent edits, and the languages in use.
 */
public record DashboardResponse(long storyId,
                                String title,
                                StoryType storyType,
                                String defaultLanguage,
                                String synopsis,
                                Instant updatedAt,
                                long totalWords,
                                long nodeCount,
                                long draftCount,
                                long doneCount,
                                List<LanguageCount> languages,
                                List<BookSummary> books,
                                List<DashboardNode> recentEdits) {
}