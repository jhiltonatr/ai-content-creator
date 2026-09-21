package com.example.company.core.archetype;

import com.example.company.core.common.BadRequestException;
import com.example.company.core.domain.NodeKind;
import com.example.company.core.domain.StoryType;

import java.util.EnumMap;
import java.util.Map;
import java.util.Set;

public final class Archetypes {

    private static final Map<StoryType, Archetype> REGISTRY = new EnumMap<>(StoryType.class);

    static {
        register(new Archetype(
                StoryType.NOVEL,
                Set.of(NodeKind.BOOK, NodeKind.CHAPTER),
                Map.of(
                        NodeKind.BOOK, Set.of(NodeKind.CHAPTER),
                        NodeKind.CHAPTER, Set.of(NodeKind.SCENE)
                ),
                Set.of()
        ));
        register(new Archetype(
                StoryType.RPG,
                Set.of(NodeKind.ACT, NodeKind.QUEST),
                Map.of(
                        NodeKind.ACT, Set.of(NodeKind.QUEST),
                        NodeKind.QUEST, Set.of(NodeKind.SUBQUEST, NodeKind.STEP),
                        NodeKind.SUBQUEST, Set.of(NodeKind.SUBQUEST, NodeKind.STEP)
                ),
                Set.of()
        ));
        register(new Archetype(
                StoryType.SCRIPT,
                Set.of(NodeKind.EPISODE, NodeKind.ACT),
                Map.of(
                        NodeKind.EPISODE, Set.of(NodeKind.ACT, NodeKind.SCENE),
                        NodeKind.ACT, Set.of(NodeKind.SCENE)
                ),
                Set.of(NodeKind.SCENE)
        ));
    }

    private static void register(Archetype archetype) {
        REGISTRY.put(archetype.storyType(), archetype);
    }

    public static Archetype forScope(StoryType storyType) {
        Archetype archetype = REGISTRY.get(storyType);
        if (archetype == null) {
            throw new BadRequestException("No archetype registered for story type " + storyType);
        }
        return archetype;
    }

    public static Map<StoryType, Archetype> all() {
        return Map.copyOf(REGISTRY);
    }

    private Archetypes() {
    }
}