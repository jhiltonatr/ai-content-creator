package com.example.company.core.release;

import com.example.company.core.domain.NodeKind;
import com.example.company.core.domain.NodeStatus;
import tools.jackson.databind.JsonNode;

/**
 * A node as frozen in a release. Carries the node {@code version} it captured at
 * publish time (and the checkpoints id when one exact-match exists) so a release
 * is an unambiguous point-in-time snapshot — the seam decision #6 relies on.
 * {@code parentId} preserves the released tree so the reader can navigate the
 * story instead of loading a flat dump of every node.
 */
public record ReleaseNode(long id,
                          Long parentId,
                          NodeKind kind,
                          String title,
                          NodeStatus status,
                          long version,
                          Long checkpointId,
                          JsonNode body,
                          JsonNode script,
                          JsonNode meta) {

    public static ReleaseNode from(com.example.company.core.node.NodeFull node, Long checkpointId) {
        return new ReleaseNode(node.id(), node.parentId(), node.kind(), node.title(), node.status(), node.version(),
                checkpointId, node.body(), node.script(), node.meta());
    }
}