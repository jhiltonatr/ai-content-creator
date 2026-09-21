package com.example.company.core.node;

import com.example.company.core.access.AccessChecker;
import com.example.company.core.archetype.Archetype;
import com.example.company.core.archetype.Archetypes;
import com.example.company.core.common.BadRequestException;
import com.example.company.core.common.ConflictException;
import com.example.company.core.common.NotFoundException;
import com.example.company.core.domain.NodeKind;
import com.example.company.core.domain.NodeStatus;
import com.example.company.core.domain.StoryType;
import com.example.company.core.story.StoryRecord;
import com.example.company.core.story.StoryRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class NodeService {

    private final NodeRepository nodes;
    private final StoryRepository stories;
    private final AccessChecker access;
    private final JsonMapper mapper;

    public NodeService(NodeRepository nodes, StoryRepository stories, AccessChecker access, JsonMapper mapper) {
        this.nodes = nodes;
        this.stories = stories;
        this.access = access;
        this.mapper = mapper;
    }

    public List<NodeSummary> tree(long userId, long storyId) {
        access.require(userId, storyId, AccessChecker.Capability.READ_DRAFTS);
        return toTree(nodes.listForStory(storyId));
    }

    public NodeFull detail(long userId, long storyId, long nodeId) {
        access.require(userId, storyId, AccessChecker.Capability.READ_DRAFTS);
        return require(storyId, nodeId);
    }

    @Transactional
    public NodeFull create(long userId, long storyId, CreateNodeRequest request) {
        access.require(userId, storyId, AccessChecker.Capability.WRITE_CONTENT);
        StoryRecord story = stories.require(storyId);
        Archetype archetype = Archetypes.forScope(story.storyType());

        NodeKind kind = NodeKind.from(request.nodeType());
        if (kind == null) {
            throw new BadRequestException("Unsupported node type: " + request.nodeType());
        }

        Long parentId = request.parentId();
        if (parentId != null) {
            NodeFull parent = require(storyId, parentId);
            if (!archetype.allowsChild(parent.kind(), kind)) {
                throw new BadRequestException(
                        "Node type " + request.nodeType() + " cannot be nested under " + parent.kind()
                                + " for story type " + story.storyType());
            }
        } else if (!archetype.allowsRoot(kind)) {
            throw new BadRequestException(
                    "Node type " + request.nodeType() + " cannot be a root node for story type " + story.storyType());
        }

        if (request.script() != null && !archetype.usesScript(kind)) {
            throw new BadRequestException("Node type " + kind + " does not use script blocks");
        }

        int sortOrder = request.sortOrder() != null
                ? request.sortOrder()
                : (int) nodes.nextSortOrder(storyId, parentId);

        JsonNode body = request.body() == null ? emptyDoc() : request.body();

        return nodes.insert(storyId, parentId, kind, request.title(), sortOrder, request.language(),
                NodeStatus.DRAFT, body, request.script(), request.meta(), userId);
    }

    @Transactional
    public NodeFull updateMetadata(long userId, long storyId, long nodeId, UpdateMetadataRequest request) {
        access.require(userId, storyId, AccessChecker.Capability.WRITE_CONTENT);
        NodeFull current = require(storyId, nodeId);
        if (isIdempotent(request.changeId(), current)) {
            return current;
        }
        ensureVersion(request.expectedVersion(), current);

        String title = request.title() == null || request.title().isBlank() ? current.title() : request.title().trim();
        NodeStatus status = request.status() == null ? current.status() : NodeStatus.from(request.status());
        if (status == null) {
            throw new BadRequestException("Unsupported status: " + request.status());
        }
        String language = request.language();

        return nodes.updateMetadata(storyId, nodeId, current.version(), request.changeId(), title, current.kind(),
                        current.parentId(), current.sortOrder(), language, status, userId)
                .orElseGet(() -> conflict(storyId, nodeId));
    }

    @Transactional
    public NodeFull move(long userId, long storyId, long nodeId, MoveNodeRequest request) {
        access.require(userId, storyId, AccessChecker.Capability.WRITE_CONTENT);
        StoryRecord story = stories.require(storyId);
        Archetype archetype = Archetypes.forScope(story.storyType());

        NodeFull current = require(storyId, nodeId);
        if (isIdempotent(request.changeId(), current)) {
            return current;
        }
        ensureVersion(request.expectedVersion(), current);

        Long parentId = request.parentId();
        if (parentId != null) {
            if (parentId == nodeId) {
                throw new BadRequestException("A node cannot be its own parent");
            }
            NodeFull parent = require(storyId, parentId);
            if (!archetype.allowsChild(parent.kind(), current.kind())) {
                throw new BadRequestException(
                        "Node type " + current.kind() + " cannot be nested under " + parent.kind());
            }
            if (isDescendant(storyId, current.id(), parent.id())) {
                throw new BadRequestException("Cannot move a node under one of its own descendants");
            }
        } else if (!archetype.allowsRoot(current.kind())) {
            throw new BadRequestException("Node type " + current.kind() + " cannot be a root node");
        }

        int sortOrder = request.sortOrder() != null
                ? request.sortOrder()
                : (int) nodes.nextSortOrder(storyId, parentId);

        return nodes.updateMetadata(storyId, nodeId, current.version(), request.changeId(), current.title(),
                        current.kind(), parentId, sortOrder, current.language(), current.status(), userId)
                .orElseGet(() -> conflict(storyId, nodeId));
    }

    @Transactional
    public NodeFull updateBody(long userId, long storyId, long nodeId, PayloadUpdateRequest request) {
        access.require(userId, storyId, AccessChecker.Capability.WRITE_CONTENT);
        NodeFull current = require(storyId, nodeId);
        if (isIdempotent(request.changeId(), current)) {
            return current;
        }
        ensureVersion(request.expectedVersion(), current);
        return nodes.updateBody(storyId, nodeId, current.version(), request.changeId(), request.payload(), userId)
                .orElseGet(() -> conflict(storyId, nodeId));
    }

    @Transactional
    public NodeFull updateScript(long userId, long storyId, long nodeId, PayloadUpdateRequest request) {
        access.require(userId, storyId, AccessChecker.Capability.WRITE_CONTENT);
        StoryRecord story = stories.require(storyId);
        Archetype archetype = Archetypes.forScope(story.storyType());
        NodeFull current = require(storyId, nodeId);
        if (!archetype.usesScript(current.kind())) {
            throw new BadRequestException("Node type " + current.kind() + " does not use script blocks");
        }
        if (isIdempotent(request.changeId(), current)) {
            return current;
        }
        ensureVersion(request.expectedVersion(), current);
        return nodes.updateScript(storyId, nodeId, current.version(), request.changeId(), request.payload(), userId)
                .orElseGet(() -> conflict(storyId, nodeId));
    }

    @Transactional
    public NodeFull updateMeta(long userId, long storyId, long nodeId, PayloadUpdateRequest request) {
        access.require(userId, storyId, AccessChecker.Capability.WRITE_CONTENT);
        NodeFull current = require(storyId, nodeId);
        if (isIdempotent(request.changeId(), current)) {
            return current;
        }
        ensureVersion(request.expectedVersion(), current);
        return nodes.updateMeta(storyId, nodeId, current.version(), request.changeId(), request.payload(), userId)
                .orElseGet(() -> conflict(storyId, nodeId));
    }

    @Transactional
    public void delete(long userId, long storyId, long nodeId) {
        access.require(userId, storyId, AccessChecker.Capability.WRITE_CONTENT);
        require(storyId, nodeId);
        Set<Long> toDelete = subtreeIds(storyId, nodeId);
        for (Long id : toDelete) {
            nodes.delete(id);
        }
    }

    private NodeFull require(long storyId, long nodeId) {
        return nodes.findById(storyId, nodeId)
                .orElseThrow(() -> new NotFoundException("Node " + nodeId + " not found in story"));
    }

    private void ensureVersion(long expectedVersion, NodeFull current) {
        if (expectedVersion != current.version()) {
            conflict(current);
        }
    }

    private boolean isIdempotent(String changeId, NodeFull current) {
        return changeId != null
                && current.lastChangeId() != null
                && current.lastChangeId().equals(changeId);
    }

    private NodeFull conflict(long storyId, long nodeId) {
        return conflict(nodes.findById(storyId, nodeId).orElseThrow());
    }

    private NodeFull conflict(NodeFull current) {
        throw new ConflictException("Node " + current.id() + " was modified by someone else", current);
    }

    private JsonNode emptyDoc() {
        return mapper.createObjectNode()
                .put("type", "doc")
                .set("content", mapper.createArrayNode());
    }

    private boolean isDescendant(long storyId, long ancestorId, long candidateId) {
        if (ancestorId == candidateId) {
            return true;
        }
        return subtreeIds(storyId, ancestorId).contains(candidateId);
    }

    private Set<Long> subtreeIds(long storyId, long rootId) {
        List<NodeFull> all = nodes.listForStory(storyId);
        Map<Long, List<Long>> byParent = new HashMap<>();
        for (NodeFull node : all) {
            if (node.parentId() != null) {
                byParent.computeIfAbsent(node.parentId(), k -> new ArrayList<>()).add(node.id());
            }
        }
        Set<Long> ids = new HashSet<>();
        Set<Long> pending = new HashSet<>();
        pending.add(rootId);
        while (!pending.isEmpty()) {
            Long next = pending.iterator().next();
            pending.remove(next);
            if (ids.add(next)) {
                pending.addAll(byParent.getOrDefault(next, List.of()));
            }
        }
        return ids;
    }

    private List<NodeSummary> toTree(List<NodeFull> nodes) {
        Map<Long, NodeSummary> index = new HashMap<>();
        for (NodeFull node : nodes) {
            index.put(node.id(), new NodeSummary(node.id(), node.kind(), node.title(), node.status(),
                    node.sortOrder(), new ArrayList<>()));
        }
        List<NodeSummary> roots = new ArrayList<>();
        for (NodeFull node : nodes) {
            NodeSummary summary = index.get(node.id());
            if (node.parentId() == null || !index.containsKey(node.parentId())) {
                roots.add(summary);
            } else {
                index.get(node.parentId()).children().add(summary);
            }
        }
        return roots;
    }
}