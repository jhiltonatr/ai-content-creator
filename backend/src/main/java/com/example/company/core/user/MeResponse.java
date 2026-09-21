package com.example.company.core.user;

import com.example.company.core.domain.Role;
import com.example.company.core.domain.StoryType;

import java.util.List;

public record MeResponse(UserInfo user, List<StoryRole> stories) {

    public record UserInfo(long id, String email, String displayName) {
    }

    public record StoryRole(long storyId, String title, StoryType storyType, Role role, int memberCount) {
    }
}