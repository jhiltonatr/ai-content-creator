package com.example.company.core.release;

import com.example.company.core.access.AccessChecker;
import com.example.company.core.checkpoint.CheckpointRecord;
import com.example.company.core.checkpoint.CheckpointRepository;
import com.example.company.core.common.NotFoundException;
import com.example.company.core.domain.NodeStatus;
import com.example.company.core.node.NodeFull;
import com.example.company.core.node.NodeRepository;
import com.example.company.core.story.StoryRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class ReleaseService {

    private final ReleaseRepository releases;
    private final NodeRepository nodes;
    private final CheckpointRepository checkpoints;
    private final StoryRepository stories;
    private final AccessChecker access;
    private final JsonMapper mapper;

    public ReleaseService(ReleaseRepository releases,
                          NodeRepository nodes,
                          CheckpointRepository checkpoints,
                          StoryRepository stories,
                          AccessChecker access,
                          JsonMapper mapper) {
        this.releases = releases;
        this.nodes = nodes;
        this.checkpoints = checkpoints;
        this.stories = stories;
        this.access = access;
        this.mapper = mapper;
    }

    /**
     * Authoring-side history: full release list is only visible to members with
     * draft access. Viewers are limited to {@link #latest}.
     */
    public List<ReleaseRecord> list(long userId, long storyId) {
        access.require(userId, storyId, AccessChecker.Capability.READ_DRAFTS);
        return releases.listForStory(storyId);
    }

    public ReleaseRecord detail(long userId, long storyId, int version) {
        access.require(userId, storyId, AccessChecker.Capability.READ_DRAFTS);
        return releases.findByVersion(storyId, version)
                .orElseThrow(() -> new NotFoundException(
                        "Release " + version + " not found for story"));
    }

    /** The single published snapshot viewers consume — never the live working set. */
    public ReleaseRecord latest(long userId, long storyId) {
        access.requireMember(userId, storyId);
        return releases.latest(storyId)
                .map(this::restoreHierarchy)
                .orElseThrow(() -> new NotFoundException("No release published for this story"));
    }

    /**
     * Snapshots published before {@code parentId} was stored have no hierarchy.
     * Reader navigation depends on it, so recover the parent/child links for the
     * released set from the current node tree. Only parents that are themselves
     * part of this release are linked (the visible tree stays inside the snapshot);
     * anything else surfaces as a root. The stored snapshot is never rewritten.
     */
    private ReleaseRecord restoreHierarchy(ReleaseRecord release) {
        JsonNode raw = release.nodes();
        if (raw == null || !raw.isArray() || raw.isEmpty()) return release;
        boolean hasParentId = false;
        for (JsonNode n : raw) {
            if (n.has("parentId")) {
                hasParentId = true;
                break;
            }
        }
        if (hasParentId) return release;

        List<NodeFull> all = nodes.listForStory(release.storyId());
        Map<Long, Long> parentById = new HashMap<>();
        for (NodeFull n : all) parentById.put(n.id(), n.parentId());
        Set<Long> releasedIds = new HashSet<>();
        for (JsonNode n : raw) releasedIds.add(n.get("id").asLong());

        ArrayNode updated = mapper.createArrayNode();
        for (JsonNode n : raw) {
            ObjectNode copy = ((ObjectNode) n).deepCopy();
            long id = n.get("id").asLong();
            Long parentId = parentById.get(id);
            if (parentId != null && releasedIds.contains(parentId)) {
                copy.put("parentId", parentId);
            } else {
                copy.putNull("parentId");
            }
            updated.add(copy);
        }
        return new ReleaseRecord(release.id(), release.storyId(), release.version(), release.name(),
                release.notes(), release.createdBy(), release.publishedAt(), updated);
    }

    @Transactional
    public ReleaseRecord create(long userId, long storyId, CreateReleaseRequest request) {
        access.require(userId, storyId, AccessChecker.Capability.PUBLISH);
        stories.require(storyId);
        List<NodeFull> all = nodes.listForStory(storyId);
        Set<Long> included = new LinkedHashSet<>();
        for (NodeFull node : all) {
            if (node.status() == NodeStatus.DONE) {
                included.add(node.id());
            }
        }
        Map<Long, Long> parentById = new HashMap<>();
        for (NodeFull node : all) {
            parentById.put(node.id(), node.parentId());
        }
        // always include ancestors so the release reads as a connected work
        for (NodeFull node : all) {
            Long parentId = node.parentId();
            while (parentId != null) {
                if (!included.add(parentId)) {
                    break;
                }
                parentId = parentById.get(parentId);
            }
        }
        List<ReleaseNode> snapshot = all.stream()
                .filter(node -> included.contains(node.id()))
                .map(node -> ReleaseNode.from(node, checkpointAt(node)))
                .toList();
        int version = releases.nextVersion(storyId);
        JsonNode nodesJson = mapper.valueToTree(snapshot);
        return releases.insert(storyId, version, request.name(), request.notes(), userId, nodesJson);
    }

    private Long checkpointAt(NodeFull node) {
        return checkpoints.findByNodeVersion(node.id(), node.version())
                .map(CheckpointRecord::id)
                .orElse(null);
    }
}