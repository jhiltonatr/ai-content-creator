package com.example.company.core.node;

import com.example.company.core.web.CurrentUserId;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/stories/{storyId}/nodes")
public class NodeController {

    private final NodeService nodes;

    public NodeController(NodeService nodes) {
        this.nodes = nodes;
    }

    @GetMapping
    public List<NodeSummary> tree(@CurrentUserId Long userId, @PathVariable long storyId) {
        return nodes.tree(userId, storyId);
    }

    @GetMapping("/{nodeId}")
    public NodeFull detail(@CurrentUserId Long userId,
                           @PathVariable long storyId,
                           @PathVariable long nodeId) {
        return nodes.detail(userId, storyId, nodeId);
    }

    @GetMapping("/{nodeId}/notes")
    public NodeNotes notes(@CurrentUserId Long userId,
                           @PathVariable long storyId,
                           @PathVariable long nodeId) {
        return nodes.notes(userId, storyId, nodeId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public NodeFull create(@CurrentUserId Long userId,
                           @PathVariable long storyId,
                           @Valid @RequestBody CreateNodeRequest request) {
        return nodes.create(userId, storyId, request);
    }

    @PutMapping("/{nodeId}")
    public NodeFull updateMetadata(@CurrentUserId Long userId,
                                   @PathVariable long storyId,
                                   @PathVariable long nodeId,
                                   @Valid @RequestBody UpdateMetadataRequest request) {
        return nodes.updateMetadata(userId, storyId, nodeId, request);
    }

    @PutMapping("/{nodeId}/move")
    public NodeFull move(@CurrentUserId Long userId,
                         @PathVariable long storyId,
                         @PathVariable long nodeId,
                         @Valid @RequestBody MoveNodeRequest request) {
        return nodes.move(userId, storyId, nodeId, request);
    }

    @PutMapping("/{nodeId}/body")
    public NodeFull updateBody(@CurrentUserId Long userId,
                               @PathVariable long storyId,
                               @PathVariable long nodeId,
                               @Valid @RequestBody PayloadUpdateRequest request) {
        return nodes.updateBody(userId, storyId, nodeId, request);
    }

    @PutMapping("/{nodeId}/script")
    public NodeFull updateScript(@CurrentUserId Long userId,
                                 @PathVariable long storyId,
                                 @PathVariable long nodeId,
                                 @Valid @RequestBody PayloadUpdateRequest request) {
        return nodes.updateScript(userId, storyId, nodeId, request);
    }

    @PutMapping("/{nodeId}/meta")
    public NodeFull updateMeta(@CurrentUserId Long userId,
                               @PathVariable long storyId,
                               @PathVariable long nodeId,
                               @Valid @RequestBody PayloadUpdateRequest request) {
        return nodes.updateMeta(userId, storyId, nodeId, request);
    }

    @PutMapping("/{nodeId}/notes")
    public NodeFull updateNotes(@CurrentUserId Long userId,
                                @PathVariable long storyId,
                                @PathVariable long nodeId,
                                @Valid @RequestBody SaveNotesRequest request) {
        return nodes.updateNotes(userId, storyId, nodeId, request);
    }

    @DeleteMapping("/{nodeId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@CurrentUserId Long userId,
                       @PathVariable long storyId,
                       @PathVariable long nodeId) {
        nodes.delete(userId, storyId, nodeId);
    }
}