package com.example.company.aicontentcreator.storage;

import com.example.company.aicontentcreator.domain.Book;
import java.util.List;
import java.util.Optional;

public interface BookRepository {

    List<Book> findByStoryId(Long storyId);

    Optional<Book> findById(Long id);

    Book save(Book book);

    void reorder(List<Long> orderedIds);

    void deleteById(Long id);

    void deleteByStoryId(Long storyId);
}