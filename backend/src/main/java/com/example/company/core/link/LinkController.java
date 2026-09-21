package com.example.company.core.link;

import com.example.company.core.web.CurrentUserId;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/stories/{storyId}/links")
public class LinkController {

    private final LinkService links;

    public LinkController(LinkService links) {
        this.links = links;
    }

    @GetMapping
    public List<LinkRecord> list(@CurrentUserId Long userId, @PathVariable long storyId) {
        return links.list(userId, storyId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public LinkRecord create(@CurrentUserId Long userId,
                             @PathVariable long storyId,
                             @Valid @RequestBody CreateLinkRequest request) {
        return links.create(userId, storyId, request);
    }

    @DeleteMapping("/{linkId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@CurrentUserId Long userId,
                       @PathVariable long storyId,
                       @PathVariable long linkId) {
        links.delete(userId, storyId, linkId);
    }
}