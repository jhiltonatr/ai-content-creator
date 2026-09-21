package com.example.company.aicontentcreator.web;

import com.example.company.aicontentcreator.domain.Chapter;
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
@RequestMapping("/api/stories/{storyId}/books/{bookId}/chapters")
public class ChapterController {

    private final StoryRepository storyRepository;
    private final BookRepository bookRepository;
    private final ChapterRepository chapterRepository;

    public ChapterController(
            StoryRepository storyRepository, BookRepository bookRepository, ChapterRepository chapterRepository) {
        this.storyRepository = storyRepository;
        this.bookRepository = bookRepository;
        this.chapterRepository = chapterRepository;
    }

    @GetMapping
    public List<Chapter> listChapters(@PathVariable Long storyId, @PathVariable Long bookId) {
        requireBook(storyId, bookId);
        return chapterRepository.findByBookId(bookId);
    }

    @GetMapping("/{chapterId}")
    public Chapter getChapter(@PathVariable Long storyId, @PathVariable Long bookId, @PathVariable Long chapterId) {
        requireBook(storyId, bookId);
        return requireChapter(bookId, chapterId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Chapter createChapter(
            @PathVariable Long storyId, @PathVariable Long bookId, @RequestBody Chapter chapter) {
        requireBook(storyId, bookId);
        return chapterRepository.save(new Chapter(null, bookId, chapter.title(), chapter.content()));
    }

    @PutMapping("/{chapterId}")
    public Chapter updateChapter(
            @PathVariable Long storyId,
            @PathVariable Long bookId,
            @PathVariable Long chapterId,
            @RequestBody Chapter chapter) {
        requireBook(storyId, bookId);
        requireChapter(bookId, chapterId);
        return chapterRepository.save(new Chapter(chapterId, bookId, chapter.title(), chapter.content()));
    }

    @DeleteMapping("/{chapterId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteChapter(@PathVariable Long storyId, @PathVariable Long bookId, @PathVariable Long chapterId) {
        requireBook(storyId, bookId);
        requireChapter(bookId, chapterId);
        chapterRepository.deleteById(chapterId);
    }

    private void requireBook(Long storyId, Long bookId) {
        storyRepository
                .findById(storyId)
                .orElseThrow(() -> new ResourceNotFoundException("Story not found: " + storyId));
        bookRepository
                .findById(bookId)
                .filter(book -> book.storyId().equals(storyId))
                .orElseThrow(() -> new ResourceNotFoundException("Book not found: " + bookId));
    }

    private Chapter requireChapter(Long bookId, Long chapterId) {
        return chapterRepository
                .findById(chapterId)
                .filter(chapter -> chapter.bookId().equals(bookId))
                .orElseThrow(() -> new ResourceNotFoundException("Chapter not found: " + chapterId));
    }
}