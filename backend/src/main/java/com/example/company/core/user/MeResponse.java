package com.example.company.core.user;

import com.example.company.core.domain.Role;
import com.example.company.core.domain.StoryType;
import com.example.company.core.domain.SystemRole;

import java.util.List;

public record MeResponse(UserInfo user, List<StoryRole> stories) {

    public record UserInfo(long id, String email, String displayName, SystemRole systemRole) {
    }

    public record StoryRole(long storyId, String title, StoryType storyType, Role role, int memberCount) {
    }
}