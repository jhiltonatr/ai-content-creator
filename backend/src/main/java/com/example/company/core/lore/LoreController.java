package com.example.company.core.lore;

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
@RequestMapping("/api/stories/{storyId}/lore")
public class LoreController {

    private final LoreService lore;

    public LoreController(LoreService lore) {
        this.lore = lore;
    }

    @GetMapping
    public List<LoreRecord> list(@CurrentUserId Long userId, @PathVariable long storyId) {
        return lore.list(userId, storyId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public LoreRecord create(@CurrentUserId Long userId,
                             @PathVariable long storyId,
                             @Valid @RequestBody SaveLoreRequest request) {
        return lore.create(userId, storyId, request);
    }

    @PutMapping("/{entryId}")
    public LoreRecord update(@CurrentUserId Long userId,
                             @PathVariable long storyId,
                             @PathVariable long entryId,
                             @Valid @RequestBody SaveLoreRequest request) {
        return lore.update(userId, storyId, entryId, request);
    }

    @DeleteMapping("/{entryId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@CurrentUserId Long userId,
                       @PathVariable long storyId,
                       @PathVariable long entryId) {
        lore.delete(userId, storyId, entryId);
    }
}