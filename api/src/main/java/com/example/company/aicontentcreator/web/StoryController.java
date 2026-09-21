package com.example.company.aicontentcreator.web;

import com.example.company.aicontentcreator.domain.Story;
import com.example.company.aicontentcreator.storage.StoryRepository;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/stories")
public class StoryController {

    private final StoryRepository storyRepository;

    public StoryController(StoryRepository storyRepository) {
        this.storyRepository = storyRepository;
    }

    @GetMapping
    public List<Story> listStories() {
        return storyRepository.findAll();
    }

    @GetMapping("/{id}")
    public Story getStory(@PathVariable Long id) {
        return storyRepository.findById(id).orElseThrow(() -> new StoryNotFoundException(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Story createStory(@RequestBody Story story) {
        return storyRepository.save(story);
    }

    @PutMapping("/{id}")
    public Story updateStory(@PathVariable Long id, @RequestBody Story story) {
        storyRepository.findById(id).orElseThrow(() -> new StoryNotFoundException(id));
        return storyRepository.save(new Story(
                id,
                story.title(),
                story.storyType(),
                story.genre(),
                story.language(),
                story.description(),
                story.tags(),
                story.content(),
                story.createdAt()));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteStory(@PathVariable Long id) {
        storyRepository.findById(id).orElseThrow(() -> new StoryNotFoundException(id));
        storyRepository.deleteById(id);
    }

    @ExceptionHandler(StoryNotFoundException.class)
    public ResponseEntity<ApiError> handleStoryNotFound(StoryNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ApiError(HttpStatus.NOT_FOUND.value(), ex.getMessage()));
    }

    private static final class StoryNotFoundException extends RuntimeException {

        private StoryNotFoundException(Long id) {
            super("Story not found: " + id);
        }
    }

    private record ApiError(int status, String message) {}
}