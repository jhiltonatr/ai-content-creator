package com.example.company.aicontentcreator.domain;

public record Chapter(Long id, Long bookId, String title, String content) {

    public Chapter {
        if (title == null || title.isBlank()) {
            throw new IllegalArgumentException("title must not be blank");
        }
        content = content == null ? "" : content;
    }
}