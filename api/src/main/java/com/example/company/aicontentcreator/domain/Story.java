package com.example.company.aicontentcreator.domain;

import java.time.OffsetDateTime;
import java.util.List;

public record Story(
        Long id,
        String title,
        StoryType storyType,
        String genre,
        Language language,
        String description,
        List<String> tags,
        OffsetDateTime createdAt) {

    public Story {
        if (title == null || title.isBlank()) {
            throw new IllegalArgumentException("title must not be blank");
        }
        if (storyType == null) {
            throw new IllegalArgumentException("storyType must not be null");
        }
        if (genre == null || genre.isBlank()) {
            throw new IllegalArgumentException("genre must not be blank");
        }
        if (language == null) {
            throw new IllegalArgumentException("language must not be null");
        }
        tags = tags == null ? List.of() : List.copyOf(tags);
    }
}