package com.example.company.core.checkpoint;

import com.example.company.core.access.AccessChecker;
import com.example.company.core.common.ConflictException;
import com.example.company.core.common.NotFoundException;
import com.example.company.core.node.NodeFull;
import com.example.company.core.node.NodeRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class CheckpointService {

    private final CheckpointRepository checkpoints;
    private final NodeRepository nodes;
    private final AccessChecker access;

    public CheckpointService(CheckpointRepository checkpoints,
                             NodeRepository nodes,
                             AccessChecker access) {
        this.checkpoints = checkpoints;
        this.nodes = nodes;
        this.access = access;
    }

    public List<CheckpointSummary> list(long userId, long storyId, long nodeId) {
        access.require(userId, storyId, AccessChecker.Capability.READ_DRAFTS);
        require(storyId, nodeId);
        return checkpoints.listForNode(nodeId).stream().map(CheckpointSummary::from).toList();
    }

    public CheckpointRecord detail(long userId, long storyId, long nodeId, long checkpointId) {
        access.require(userId, storyId, AccessChecker.Capability.READ_DRAFTS);
        require(storyId, nodeId);
        return requireCheckpoint(nodeId, checkpointId);
    }

    @Transactional
    public CheckpointRecord create(long userId, long storyId, long nodeId, CreateCheckpointRequest request) {
        access.require(userId, storyId, AccessChecker.Capability.WRITE_CONTENT);
        NodeFull node = require(storyId, nodeId);
        return checkpoints.insert(nodeId, node.version(), node.title(), node.body(), node.script(), node.meta(),
                request.note(), userId);
    }

    /**
     * Reverts a node to the payloads captured by a checkpoint. Before restoring, the
     * current working set is itself snapshotted so the revert shows up in the timeline
     * and can be undone — the explicit safety net over the raw 409 flow.
     */
    @Transactional
    public NodeFull restore(long userId, long storyId, long nodeId, long checkpointId, RestoreCheckpointRequest request) {
        access.require(userId, storyId, AccessChecker.Capability.WRITE_CONTENT);
        NodeFull current = require(storyId, nodeId);
        if (isIdempotent(request.changeId(), current)) {
            return current;
        }
        ensureVersion(request.expectedVersion(), current);
        CheckpointRecord snapshot = requireCheckpoint(nodeId, checkpointId);

        String revertNote = snapshot.note() == null || snapshot.note().isBlank()
                ? "Pre-revert copy (checkpoint #" + snapshot.id() + ")"
                : "Pre-revert copy: " + snapshot.note();
        checkpoints.insert(nodeId, current.version(), current.title(), current.body(), current.script(), current.meta(),
                revertNote, userId);

        return nodes.restoreFromPayloads(storyId, nodeId, current.version(), request.changeId(),
                        snapshot.title(), snapshot.body(), snapshot.script(), snapshot.meta(), userId)
                .orElseGet(() -> conflict(current));
    }

    private NodeFull require(long storyId, long nodeId) {
        return nodes.findById(storyId, nodeId)
                .orElseThrow(() -> new NotFoundException("Node " + nodeId + " not found in story"));
    }

    private CheckpointRecord requireCheckpoint(long nodeId, long checkpointId) {
        return checkpoints.findById(nodeId, checkpointId)
                .orElseThrow(() -> new NotFoundException("Checkpoint " + checkpointId + " not found for node"));
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

    private NodeFull conflict(NodeFull current) {
        throw new ConflictException("Node " + current.id() + " was modified by someone else", current);
    }
}