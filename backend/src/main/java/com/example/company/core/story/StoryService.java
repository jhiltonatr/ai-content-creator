package com.example.company.core.story;

import com.example.company.core.access.AccessChecker;
import com.example.company.core.common.BadRequestException;
import com.example.company.core.domain.Role;
import com.example.company.core.domain.StoryType;
import com.example.company.core.membership.MembershipRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class StoryService {

    private final StoryRepository stories;
    private final MembershipRepository memberships;
    private final AccessChecker access;

    public StoryService(StoryRepository stories,
                        MembershipRepository memberships,
                        AccessChecker access) {
        this.stories = stories;
        this.memberships = memberships;
        this.access = access;
    }

    @Transactional
    public StoryWithRole create(long userId, CreateStoryRequest request) {
        StoryType storyType = StoryType.from(request.storyType());
        if (storyType == null) {
            throw new BadRequestException("Unsupported story type: " + request.storyType());
        }
        String language = request.defaultLanguage() == null || request.defaultLanguage().isBlank()
                ? "en"
                : request.defaultLanguage().trim();
        StoryRecord story = stories.create(request.title(), storyType, language, request.synopsis(),
                request.settings(), userId);
        memberships.upsert(story.id(), userId, Role.OWNER);
        return story.withRole(Role.OWNER);
    }

    public List<StoryWithRole> listMine(long userId) {
        return stories.listForUser(userId);
    }

    public StoryWithRole detail(long userId, long storyId) {
        Role role = access.requireMember(userId, storyId);
        StoryRecord story = stories.require(storyId);
        return story.withRole(role);
    }

    @Transactional
    public StoryWithRole update(long userId, long storyId, UpdateStoryRequest request) {
        Role role = access.require(userId, storyId, AccessChecker.Capability.MANAGE_STORY);
        String language = request.defaultLanguage() == null || request.defaultLanguage().isBlank()
                ? "en"
                : request.defaultLanguage().trim();
        StoryRecord updated = stories.update(storyId, request.title(), language, request.synopsis(),
                request.settings(), userId);
        return updated.withRole(role);
    }

    @Transactional
    public void delete(long userId, long storyId) {
        access.require(userId, storyId, AccessChecker.Capability.MANAGE_STORY);
        stories.delete(storyId);
    }
}