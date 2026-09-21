package com.example.company.core.domain;

public enum NodeKind {
    BOOK,
    CHAPTER,
    SCENE,
    EPISODE,
    ACT,
    QUEST,
    SUBQUEST,
    STEP,
    BEAT;

    public static NodeKind from(String value) {
        return value == null ? null : NodeKind.valueOf(value.toUpperCase());
    }
}