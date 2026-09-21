package com.example.company.core.domain;

public enum LinkKind {
    MENTIONS,
    LOCATED_IN,
    PREREQUISITE,
    UNLOCKS,
    RESOLVES,
    REFERENCES;

    public static LinkKind from(String value) {
        return value == null ? null : LinkKind.valueOf(value.toUpperCase());
    }
}