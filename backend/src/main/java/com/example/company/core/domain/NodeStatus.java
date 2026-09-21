package com.example.company.core.domain;

public enum NodeStatus {
    DRAFT,
    DONE;

    public static NodeStatus from(String value) {
        return value == null ? null : NodeStatus.valueOf(value.toUpperCase());
    }
}