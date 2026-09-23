package com.example.company.core.checkpoint;

import com.example.company.core.web.CurrentUserId;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/stories/{storyId}/nodes/{nodeId}/checkpoints")
public class CheckpointController {

    private final CheckpointService checkpoints;

    public CheckpointController(CheckpointService checkpoints) {
        this.checkpoints = checkpoints;
    }

    @GetMapping
    public List<CheckpointSummary> list(@CurrentUserId Long userId,
                                        @PathVariable long storyId,
                                        @PathVariable long nodeId) {
        return checkpoints.list(userId, storyId, nodeId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CheckpointRecord create(@CurrentUserId Long userId,
                                   @PathVariable long storyId,
                                   @PathVariable long nodeId,
                                   @Valid @RequestBody CreateCheckpointRequest request) {
        return checkpoints.create(userId, storyId, nodeId, request);
    }

    @GetMapping("/{checkpointId}")
    public CheckpointRecord detail(@CurrentUserId Long userId,
                                   @PathVariable long storyId,
                                   @PathVariable long nodeId,
                                   @PathVariable long checkpointId) {
        return checkpoints.detail(userId, storyId, nodeId, checkpointId);
    }

    @PostMapping("/{checkpointId}/restore")
    public com.example.company.core.node.NodeFull restore(@CurrentUserId Long userId,
                                                          @PathVariable long storyId,
                                                          @PathVariable long nodeId,
                                                          @PathVariable long checkpointId,
                                                          @Valid @RequestBody RestoreCheckpointRequest request) {
        return checkpoints.restore(userId, storyId, nodeId, checkpointId, request);
    }
}