package com.example.company.aicontentcreator.storage;

import com.example.company.aicontentcreator.domain.Book;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.atomic.AtomicLong;
import org.springframework.stereotype.Repository;

@Repository
public class InMemoryBookRepository implements BookRepository {

    private final ConcurrentMap<Long, Book> books = new ConcurrentHashMap<>();
    private final AtomicLong sequence = new AtomicLong(1);

    @Override
    public List<Book> findByStoryId(Long storyId) {
        return books.values().stream()
                .filter(book -> book.storyId().equals(storyId))
                .sorted(Comparator.comparing(Book::sortOrder).thenComparing(Book::id))
                .toList();
    }

    @Override
    public Optional<Book> findById(Long id) {
        return Optional.ofNullable(books.get(id));
    }

    @Override
    public Book save(Book book) {
        Book toStore;
        if (book.id() == null) {
            int nextOrder = books.values().stream()
                    .filter(existing -> existing.storyId().equals(book.storyId()))
                    .mapToInt(Book::sortOrder)
                    .max()
                    .orElse(-1) + 1;
            toStore = new Book(sequence.getAndIncrement(), book.storyId(), book.title(), nextOrder);
        } else {
            toStore = book;
        }
        books.put(toStore.id(), toStore);
        return toStore;
    }

    @Override
    public void reorder(List<Long> orderedIds) {
        for (int i = 0; i < orderedIds.size(); i++) {
            Book book = books.get(orderedIds.get(i));
            if (book != null) {
                books.put(book.id(), new Book(book.id(), book.storyId(), book.title(), i));
            }
        }
    }

    @Override
    public void deleteById(Long id) {
        books.remove(id);
    }

    @Override
    public void deleteByStoryId(Long storyId) {
        List<Book> toDelete = findByStoryId(storyId);
        toDelete.forEach(book -> books.remove(book.id()));
    }
}