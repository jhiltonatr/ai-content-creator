package com.example.company.core.story;

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
@RequestMapping("/api/stories")
public class StoryController {

    private final StoryService stories;

    public StoryController(StoryService stories) {
        this.stories = stories;
    }

    @GetMapping
    public List<StoryWithRole> list(@CurrentUserId Long userId) {
        return stories.listMine(userId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public StoryWithRole create(@CurrentUserId Long userId, @Valid @RequestBody CreateStoryRequest request) {
        return stories.create(userId, request);
    }

    @GetMapping("/{storyId}")
    public StoryWithRole get(@CurrentUserId Long userId, @PathVariable long storyId) {
        return stories.detail(userId, storyId);
    }

    @PutMapping("/{storyId}")
    public StoryWithRole update(@CurrentUserId Long userId,
                                @PathVariable long storyId,
                                @Valid @RequestBody UpdateStoryRequest request) {
        return stories.update(userId, storyId, request);
    }

    @DeleteMapping("/{storyId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@CurrentUserId Long userId, @PathVariable long storyId) {
        stories.delete(userId, storyId);
    }
}