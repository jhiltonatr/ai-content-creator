package com.example.company.core.access;

import com.example.company.core.common.ForbiddenException;
import com.example.company.core.domain.Role;
import com.example.company.core.membership.MembershipRepository;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class AccessChecker {

    private final MembershipRepository memberships;

    public AccessChecker(MembershipRepository memberships) {
        this.memberships = memberships;
    }

    public enum Capability {
        MANAGE_STORY,
        MANAGE_MEMBERS,
        WRITE_CONTENT,
        READ_DRAFTS,
        PUBLISH
    }

    public Role require(long userId, long storyId, Capability capability) {
        Role role = memberships.roleFor(userId, storyId)
                .orElseThrow(() -> new ForbiddenException("User is not a member of this story"));
        if (!allows(capability, role)) {
            throw new ForbiddenException("Role " + role + " cannot perform " + capability);
        }
        return role;
    }

    public Role requireMember(long userId, long storyId) {
        return memberships.roleFor(userId, storyId)
                .orElseThrow(() -> new ForbiddenException("User is not a member of this story"));
    }

    private boolean allows(Capability capability, Role role) {
        return switch (capability) {
            case MANAGE_STORY, MANAGE_MEMBERS, PUBLISH -> role == Role.OWNER;
            case WRITE_CONTENT -> role == Role.OWNER || role == Role.COLLABORATOR;
            case READ_DRAFTS -> role == Role.OWNER || role == Role.COLLABORATOR || role == Role.EDITOR;
        };
    }
}