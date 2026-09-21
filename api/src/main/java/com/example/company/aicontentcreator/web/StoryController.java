package com.example.company.aicontentcreator.web;

import com.example.company.aicontentcreator.domain.Story;
import com.example.company.aicontentcreator.storage.BookRepository;
import com.example.company.aicontentcreator.storage.ChapterRepository;
import com.example.company.aicontentcreator.storage.StoryRepository;
import java.util.List;
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

@RestController
@RequestMapping("/api/stories")
public class StoryController {

    private final StoryRepository storyRepository;
    private final BookRepository bookRepository;
    private final ChapterRepository chapterRepository;

    public StoryController(
            StoryRepository storyRepository, BookRepository bookRepository, ChapterRepository chapterRepository) {
        this.storyRepository = storyRepository;
        this.bookRepository = bookRepository;
        this.chapterRepository = chapterRepository;
    }

    @GetMapping
    public List<Story> listStories() {
        return storyRepository.findAll();
    }

    @GetMapping("/{id}")
    public Story getStory(@PathVariable Long id) {
        return requireStory(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Story createStory(@RequestBody Story story) {
        return storyRepository.save(story);
    }

    @PutMapping("/{id}")
    public Story updateStory(@PathVariable Long id, @RequestBody Story story) {
        requireStory(id);
        return storyRepository.save(new Story(
                id,
                story.title(),
                story.storyType(),
                story.genre(),
                story.language(),
                story.description(),
                story.tags(),
                story.createdAt()));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteStory(@PathVariable Long id) {
        requireStory(id);
        bookRepository.findByStoryId(id).forEach(book -> chapterRepository.deleteByBookId(book.id()));
        bookRepository.deleteByStoryId(id);
        storyRepository.deleteById(id);
    }

    private Story requireStory(Long id) {
        return storyRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Story not found: " + id));
    }
}