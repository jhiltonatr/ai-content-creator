package com.example.company.core.node;

import jakarta.validation.constraints.NotNull;

public record MoveNodeRequest(
        @NotNull Long expectedVersion,
        String changeId,
        Long parentId,
        Integer sortOrder) {
}