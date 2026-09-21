package com.example.company.core.lore;

import com.example.company.core.access.AccessChecker;
import com.example.company.core.common.NotFoundException;
import com.example.company.core.story.StoryRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class LoreService {

    private final LoreRepository lore;
    private final StoryRepository stories;
    private final AccessChecker access;

    public LoreService(LoreRepository lore, StoryRepository stories, AccessChecker access) {
        this.lore = lore;
        this.stories = stories;
        this.access = access;
    }

    public List<LoreRecord> list(long userId, long storyId) {
        access.require(userId, storyId, AccessChecker.Capability.READ_DRAFTS);
        return lore.listForStory(storyId);
    }

    @Transactional
    public LoreRecord create(long userId, long storyId, SaveLoreRequest request) {
        access.require(userId, storyId, AccessChecker.Capability.WRITE_CONTENT);
        stories.require(storyId);
        return lore.insert(storyId, request.title(), request.category(), request.body(), userId);
    }

    @Transactional
    public LoreRecord update(long userId, long storyId, long entryId, SaveLoreRequest request) {
        access.require(userId, storyId, AccessChecker.Capability.WRITE_CONTENT);
        return lore.update(storyId, entryId, request.title(), request.category(), request.body(), userId)
                .orElseThrow(() -> new NotFoundException("Lore entry " + entryId + " not found in story"));
    }

    @Transactional
    public void delete(long userId, long storyId, long entryId) {
        access.require(userId, storyId, AccessChecker.Capability.WRITE_CONTENT);
        lore.delete(storyId, entryId);
    }
}