package com.example.company.aicontentcreator.storage;

import com.example.company.aicontentcreator.domain.Chapter;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.atomic.AtomicLong;
import org.springframework.stereotype.Repository;

@Repository
public class InMemoryChapterRepository implements ChapterRepository {

    private final ConcurrentMap<Long, Chapter> chapters = new ConcurrentHashMap<>();
    private final AtomicLong sequence = new AtomicLong(1);

    @Override
    public List<Chapter> findByBookId(Long bookId) {
        return chapters.values().stream()
                .filter(chapter -> chapter.bookId().equals(bookId))
                .sorted(Comparator.comparing(Chapter::id))
                .toList();
    }

    @Override
    public Optional<Chapter> findById(Long id) {
        return Optional.ofNullable(chapters.get(id));
    }

    @Override
    public Chapter save(Chapter chapter) {
        Chapter toStore;
        if (chapter.id() == null) {
            toStore = new Chapter(sequence.getAndIncrement(), chapter.bookId(), chapter.title(), chapter.content());
        } else {
            toStore = chapter;
        }
        chapters.put(toStore.id(), toStore);
        return toStore;
    }

    @Override
    public void deleteById(Long id) {
        chapters.remove(id);
    }

    @Override
    public void deleteByBookId(Long bookId) {
        List<Chapter> toDelete = findByBookId(bookId);
        toDelete.forEach(chapter -> chapters.remove(chapter.id()));
    }
}