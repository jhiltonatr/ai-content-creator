package com.example.company.core.domain;

public enum EntityType {
    NODE,
    CHARACTER,
    STORY,
    LORE_ENTRY;

    public static EntityType from(String value) {
        return value == null ? null : EntityType.valueOf(value.toUpperCase());
    }
}