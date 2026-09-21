package com.example.company.core.character;

import com.example.company.core.access.AccessChecker;
import com.example.company.core.common.NotFoundException;
import com.example.company.core.story.StoryRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class CharacterService {

    private final CharacterRepository characters;
    private final StoryRepository stories;
    private final AccessChecker access;

    public CharacterService(CharacterRepository characters, StoryRepository stories, AccessChecker access) {
        this.characters = characters;
        this.stories = stories;
        this.access = access;
    }

    public List<CharacterRecord> list(long userId, long storyId) {
        access.require(userId, storyId, AccessChecker.Capability.READ_DRAFTS);
        return characters.listForStory(storyId);
    }

    @Transactional
    public CharacterRecord create(long userId, long storyId, SaveCharacterRequest request) {
        access.require(userId, storyId, AccessChecker.Capability.WRITE_CONTENT);
        stories.require(storyId);
        return characters.insert(storyId, request.name(), request.attributes(), request.bio(), request.notes(), userId);
    }

    @Transactional
    public CharacterRecord update(long userId, long storyId, long characterId, SaveCharacterRequest request) {
        access.require(userId, storyId, AccessChecker.Capability.WRITE_CONTENT);
        return characters.update(storyId, characterId, request.name(), request.attributes(), request.bio(),
                        request.notes(), userId)
                .orElseThrow(() -> new NotFoundException("Character " + characterId + " not found in story"));
    }

    @Transactional
    public void delete(long userId, long storyId, long characterId) {
        access.require(userId, storyId, AccessChecker.Capability.WRITE_CONTENT);
        characters.delete(storyId, characterId);
    }
}