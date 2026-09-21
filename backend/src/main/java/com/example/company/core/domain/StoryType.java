package com.example.company.core.domain;

public enum StoryType {
    NOVEL,
    RPG,
    SCRIPT;

    public static StoryType from(String value) {
        return value == null ? null : StoryType.valueOf(value.toUpperCase());
    }
}