package com.example.company.core.domain;

public enum Role {
    OWNER,
    COLLABORATOR,
    EDITOR,
    VIEWER;

    public static Role from(String value) {
        return value == null ? null : Role.valueOf(value.toUpperCase());
    }
}