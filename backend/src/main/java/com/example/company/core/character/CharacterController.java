package com.example.company.core.character;

import com.example.company.core.web.CurrentUserId;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/stories/{storyId}/characters")
public class CharacterController {

    private final CharacterService characters;

    public CharacterController(CharacterService characters) {
        this.characters = characters;
    }

    @GetMapping
    public List<CharacterRecord> list(@CurrentUserId Long userId, @PathVariable long storyId) {
        return characters.list(userId, storyId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CharacterRecord create(@CurrentUserId Long userId,
                                  @PathVariable long storyId,
                                  @Valid @RequestBody SaveCharacterRequest request) {
        return characters.create(userId, storyId, request);
    }

    @PutMapping("/{characterId}")
    public CharacterRecord update(@CurrentUserId Long userId,
                                  @PathVariable long storyId,
                                  @PathVariable long characterId,
                                  @Valid @RequestBody SaveCharacterRequest request) {
        return characters.update(userId, storyId, characterId, request);
    }

    @DeleteMapping("/{characterId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@CurrentUserId Long userId,
                       @PathVariable long storyId,
                       @PathVariable long characterId) {
        characters.delete(userId, storyId, characterId);
    }
}