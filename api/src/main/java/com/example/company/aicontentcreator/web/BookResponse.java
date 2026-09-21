package com.example.company.aicontentcreator.web;

import com.example.company.aicontentcreator.domain.Book;
import com.example.company.aicontentcreator.domain.Chapter;
import java.util.List;

public record BookResponse(Long id, Long storyId, String title, Integer sortOrder, List<Chapter> chapters) {

    public static BookResponse of(Book book, List<Chapter> chapters) {
        return new BookResponse(book.id(), book.storyId(), book.title(), book.sortOrder(), chapters);
    }
}