package com.example.company.core.membership;

import com.example.company.core.web.CurrentUserId;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/stories/{storyId}/members")
public class MembershipController {

    private final MembershipService memberships;

    public MembershipController(MembershipService memberships) {
        this.memberships = memberships;
    }

    @GetMapping
    public List<MembershipRecord> list(@CurrentUserId Long userId, @PathVariable long storyId) {
        return memberships.list(userId, storyId);
    }

    @PostMapping
    public List<MembershipRecord> add(@CurrentUserId Long userId,
                                      @PathVariable long storyId,
                                      @Valid @RequestBody AddMemberRequest request) {
        return memberships.add(userId, storyId, request);
    }

    @PutMapping("/{memberUserId}")
    public List<MembershipRecord> updateRole(@CurrentUserId Long userId,
                                             @PathVariable long storyId,
                                             @PathVariable long memberUserId,
                                             @Valid @RequestBody UpdateRoleRequest request) {
        return memberships.updateRole(userId, storyId, memberUserId, request);
    }

    @DeleteMapping("/{memberUserId}")
    public List<MembershipRecord> remove(@CurrentUserId Long userId,
                                         @PathVariable long storyId,
                                         @PathVariable long memberUserId) {
        return memberships.remove(userId, storyId, memberUserId);
    }
}