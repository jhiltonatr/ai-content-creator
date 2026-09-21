package com.example.company.core.release;

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
@RequestMapping("/api/stories/{storyId}/releases")
public class ReleaseController {

    private final ReleaseService releases;

    public ReleaseController(ReleaseService releases) {
        this.releases = releases;
    }

    @GetMapping
    public List<ReleaseRecord> list(@CurrentUserId Long userId, @PathVariable long storyId) {
        return releases.list(userId, storyId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ReleaseRecord create(@CurrentUserId Long userId,
                                @PathVariable long storyId,
                                @Valid @RequestBody CreateReleaseRequest request) {
        return releases.create(userId, storyId, request);
    }

    @GetMapping("/{version}")
    public ReleaseRecord detail(@CurrentUserId Long userId,
                                @PathVariable long storyId,
                                @PathVariable int version) {
        return releases.detail(userId, storyId, version);
    }
}