package com.example.company.core.story;

import com.example.company.core.domain.Role;
import com.example.company.core.domain.StoryType;
import tools.jackson.databind.JsonNode;

import java.time.Instant;

public record StoryRecord(long id,
                          String title,
                          StoryType storyType,
                          String defaultLanguage,
                          String synopsis,
                          JsonNode settings,
                          Instant createdAt,
                          Instant updatedAt) {

    public StoryWithRole withRole(Role role) {
        return new StoryWithRole(id, title, storyType, defaultLanguage, synopsis, settings, createdAt, updatedAt, role);
    }
}