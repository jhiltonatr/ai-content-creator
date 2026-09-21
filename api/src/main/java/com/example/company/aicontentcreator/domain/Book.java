package com.example.company.aicontentcreator.domain;

public record Book(Long id, Long storyId, String title, Integer sortOrder) {

    public Book {
        if (title == null || title.isBlank()) {
            throw new IllegalArgumentException("title must not be blank");
        }
        sortOrder = sortOrder == null ? 0 : sortOrder;
    }
}