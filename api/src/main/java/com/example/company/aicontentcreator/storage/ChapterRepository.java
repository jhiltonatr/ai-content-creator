package com.example.company.aicontentcreator.storage;

import com.example.company.aicontentcreator.domain.Chapter;
import java.util.List;
import java.util.Optional;

public interface ChapterRepository {

    List<Chapter> findByBookId(Long bookId);

    Optional<Chapter> findById(Long id);

    Chapter save(Chapter chapter);

    void deleteById(Long id);

    void deleteByBookId(Long bookId);
}