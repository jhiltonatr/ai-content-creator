package com.example.company.core.archetype;

import com.example.company.core.domain.NodeKind;
import com.example.company.core.domain.StoryType;

import java.util.Map;
import java.util.Set;

public record Archetype(StoryType storyType,
                        Set<NodeKind> rootKinds,
                        Map<NodeKind, Set<NodeKind>> allowedChildren,
                        Set<NodeKind> scriptKinds) {

    public boolean allowsRoot(NodeKind kind) {
        return rootKinds.contains(kind);
    }

    public boolean allowsChild(NodeKind parent, NodeKind child) {
        return allowedChildren.getOrDefault(parent, Set.of()).contains(child);
    }

    public boolean usesScript(NodeKind kind) {
        return scriptKinds.contains(kind);
    }
}