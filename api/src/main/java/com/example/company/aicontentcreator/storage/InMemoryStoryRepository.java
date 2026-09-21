package com.example.company.aicontentcreator.storage;

import com.example.company.aicontentcreator.domain.Story;
import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.atomic.AtomicLong;
import org.springframework.stereotype.Repository;

@Repository
public class InMemoryStoryRepository implements StoryRepository {

    private final ConcurrentMap<Long, Story> stories = new ConcurrentHashMap<>();
    private final AtomicLong sequence = new AtomicLong(1);

    @Override
    public List<Story> findAll() {
        return stories.values().stream()
                .sorted(Comparator.comparing(Story::id))
                .toList();
    }

    @Override
    public Optional<Story> findById(Long id) {
        return Optional.ofNullable(stories.get(id));
    }

    @Override
    public Story save(Story story) {
        Story toStore;
        if (story.id() == null) {
            toStore = new Story(
                    sequence.getAndIncrement(),
                    story.title(),
                    story.storyType(),
                    story.genre(),
                    story.language(),
                    story.description(),
                    story.tags(),
                    story.content(),
                    OffsetDateTime.now());
        } else {
            Story existing = stories.get(story.id());
            OffsetDateTime createdAt = story.createdAt();
            if (createdAt == null && existing != null) {
                createdAt = existing.createdAt();
            }
            toStore = new Story(
                    story.id(),
                    story.title(),
                    story.storyType(),
                    story.genre(),
                    story.language(),
                    story.description(),
                    story.tags(),
                    story.content(),
                    createdAt);
        }
        stories.put(toStore.id(), toStore);
        return toStore;
    }

    @Override
    public void deleteById(Long id) {
        stories.remove(id);
    }
}