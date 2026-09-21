package com.example.company.core.link;

import com.example.company.core.access.AccessChecker;
import com.example.company.core.character.CharacterRepository;
import com.example.company.core.common.BadRequestException;
import com.example.company.core.common.NotFoundException;
import com.example.company.core.domain.EntityType;
import com.example.company.core.domain.LinkKind;
import com.example.company.core.lore.LoreRepository;
import com.example.company.core.node.NodeRepository;
import com.example.company.core.story.StoryRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class LinkService {

    private final LinkRepository links;
    private final NodeRepository nodes;
    private final CharacterRepository characters;
    private final LoreRepository lore;
    private final StoryRepository stories;
    private final AccessChecker access;

    public LinkService(LinkRepository links,
                       NodeRepository nodes,
                       CharacterRepository characters,
                       LoreRepository lore,
                       StoryRepository stories,
                       AccessChecker access) {
        this.links = links;
        this.nodes = nodes;
        this.characters = characters;
        this.lore = lore;
        this.stories = stories;
        this.access = access;
    }

    public List<LinkRecord> list(long userId, long storyId) {
        access.require(userId, storyId, AccessChecker.Capability.READ_DRAFTS);
        return links.listForStory(storyId);
    }

    @Transactional
    public LinkRecord create(long userId, long storyId, CreateLinkRequest request) {
        access.require(userId, storyId, AccessChecker.Capability.WRITE_CONTENT);
        EntityType fromType = EntityType.from(request.fromType());
        EntityType toType = EntityType.from(request.toType());
        LinkKind kind = LinkKind.from(request.kind());
        if (fromType == null || toType == null) {
            throw new BadRequestException("Unsupported entity type in link");
        }
        if (kind == null) {
            throw new BadRequestException("Unsupported link kind: " + request.kind());
        }
        requireEndpoint(storyId, fromType, request.fromId());
        requireEndpoint(storyId, toType, request.toId());
        return links.insert(storyId, fromType, request.fromId(), toType, request.toId(), kind, userId);
    }

    @Transactional
    public void delete(long userId, long storyId, long linkId) {
        access.require(userId, storyId, AccessChecker.Capability.WRITE_CONTENT);
        links.findById(storyId, linkId)
                .orElseThrow(() -> new NotFoundException("Link " + linkId + " not found in story"));
        links.delete(storyId, linkId);
    }

    private void requireEndpoint(long storyId, EntityType type, long id) {
        boolean exists = switch (type) {
            case NODE -> nodes.findById(storyId, id).isPresent();
            case CHARACTER -> characters.exists(storyId, id);
            case LORE_ENTRY -> lore.exists(storyId, id);
            case STORY -> stories.findById(id).isPresent();
        };
        if (!exists) {
            throw new BadRequestException("Link endpoint " + type + ":" + id + " does not exist");
        }
    }
}