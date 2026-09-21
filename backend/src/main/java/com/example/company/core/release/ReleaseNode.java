package com.example.company.core.release;

import com.example.company.core.domain.NodeKind;
import com.example.company.core.domain.NodeStatus;
import tools.jackson.databind.JsonNode;

public record ReleaseNode(long id,
                          NodeKind kind,
                          String title,
                          NodeStatus status,
                          JsonNode body,
                          JsonNode script,
                          JsonNode meta) {

    public static ReleaseNode from(com.example.company.core.node.NodeFull node) {
        return new ReleaseNode(node.id(), node.kind(), node.title(), node.status(),
                node.body(), node.script(), node.meta());
    }
}