package com.example.company.aicontentcreator.web;

import com.example.company.aicontentcreator.domain.Book;
import com.example.company.aicontentcreator.storage.BookRepository;
import com.example.company.aicontentcreator.storage.ChapterRepository;
import com.example.company.aicontentcreator.storage.StoryRepository;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
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
@RequestMapping("/api/stories/{storyId}/books")
public class BookController {

    private final StoryRepository storyRepository;
    private final BookRepository bookRepository;
    private final ChapterRepository chapterRepository;

    public BookController(
            StoryRepository storyRepository, BookRepository bookRepository, ChapterRepository chapterRepository) {
        this.storyRepository = storyRepository;
        this.bookRepository = bookRepository;
        this.chapterRepository = chapterRepository;
    }

    @GetMapping
    public List<BookResponse> listBooks(@PathVariable Long storyId) {
        requireStory(storyId);
        return bookRepository.findByStoryId(storyId).stream()
                .map(book -> toResponse(book))
                .toList();
    }

    @GetMapping("/{bookId}")
    public BookResponse getBook(@PathVariable Long storyId, @PathVariable Long bookId) {
        requireStory(storyId);
        return toResponse(requireBook(storyId, bookId));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public BookResponse createBook(@PathVariable Long storyId, @RequestBody Book book) {
        requireStory(storyId);
        Book saved = bookRepository.save(new Book(null, storyId, book.title(), 0));
        return toResponse(saved);
    }

    @PutMapping("/{bookId}")
    public BookResponse updateBook(@PathVariable Long storyId, @PathVariable Long bookId, @RequestBody Book book) {
        requireStory(storyId);
        Book existing = requireBook(storyId, bookId);
        Book saved = bookRepository.save(new Book(bookId, storyId, book.title(), existing.sortOrder()));
        return toResponse(saved);
    }

    @PutMapping("/order")
    public List<BookResponse> reorderBooks(
            @PathVariable Long storyId, @RequestBody ReorderBooksRequest request) {
        requireStory(storyId);
        List<Book> existing = bookRepository.findByStoryId(storyId);
        List<Long> requestedIds = request.bookIds();
        if (requestedIds == null
                || requestedIds.size() != existing.size()
                || !new HashSet<>(requestedIds).equals(Set.copyOf(existing.stream().map(Book::id).toList()))) {
            throw new IllegalArgumentException("Book order must include exactly the story's books");
        }
        bookRepository.reorder(requestedIds);
        return bookRepository.findByStoryId(storyId).stream().map(this::toResponse).toList();
    }

    @DeleteMapping("/{bookId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteBook(@PathVariable Long storyId, @PathVariable Long bookId) {
        requireStory(storyId);
        requireBook(storyId, bookId);
        chapterRepository.deleteByBookId(bookId);
        bookRepository.deleteById(bookId);
    }

    private void requireStory(Long storyId) {
        storyRepository
                .findById(storyId)
                .orElseThrow(() -> new ResourceNotFoundException("Story not found: " + storyId));
    }

    private Book requireBook(Long storyId, Long bookId) {
        return bookRepository
                .findById(bookId)
                .filter(book -> book.storyId().equals(storyId))
                .orElseThrow(() -> new ResourceNotFoundException("Book not found: " + bookId));
    }

    private BookResponse toResponse(Book book) {
        return BookResponse.of(book, chapterRepository.findByBookId(book.id()));
    }

    public record ReorderBooksRequest(List<Long> bookIds) {}
}