package com.example.company.core.domain;

public enum SystemRole {
    USER,
    ADMIN;

    public static SystemRole from(String value) {
        return value == null ? null : SystemRole.valueOf(value.toUpperCase());
    }
}