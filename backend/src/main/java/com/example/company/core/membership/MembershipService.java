package com.example.company.core.membership;

import com.example.company.core.access.AccessChecker;
import com.example.company.core.common.BadRequestException;
import com.example.company.core.domain.Role;
import com.example.company.core.story.StoryRepository;
import com.example.company.core.user.FindOrCreateUserRequest;
import com.example.company.core.user.UserRecord;
import com.example.company.core.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class MembershipService {

    private final MembershipRepository memberships;
    private final UserRepository users;
    private final StoryRepository stories;
    private final AccessChecker access;

    public MembershipService(MembershipRepository memberships,
                             UserRepository users,
                             StoryRepository stories,
                             AccessChecker access) {
        this.memberships = memberships;
        this.users = users;
        this.stories = stories;
        this.access = access;
    }

    public List<MembershipRecord> list(long userId, long storyId) {
        access.require(userId, storyId, AccessChecker.Capability.READ_DRAFTS);
        return memberships.listForStory(storyId);
    }

    @Transactional
    public List<MembershipRecord> add(long userId, long storyId, AddMemberRequest request) {
        access.require(userId, storyId, AccessChecker.Capability.MANAGE_MEMBERS);
        stories.require(storyId);
        UserRecord user = users.findByEmail(request.email())
                .orElseGet(() -> users.create(request.email(), request.displayName()));
        Role role = Role.from(request.role());
        if (role == null) {
            throw new BadRequestException("Unsupported role: " + request.role());
        }
        memberships.upsert(storyId, user.id(), role);
        return memberships.listForStory(storyId);
    }

    @Transactional
    public List<MembershipRecord> updateRole(long userId, long storyId, long memberUserId, UpdateRoleRequest request) {
        access.require(userId, storyId, AccessChecker.Capability.MANAGE_MEMBERS);
        Role role = Role.from(request.role());
        if (role == null) {
            throw new BadRequestException("Unsupported role: " + request.role());
        }
        ensureNotLastOwner(storyId, memberUserId);
        memberships.upsert(storyId, memberUserId, role);
        return memberships.listForStory(storyId);
    }

    @Transactional
    public List<MembershipRecord> remove(long userId, long storyId, long memberUserId) {
        access.require(userId, storyId, AccessChecker.Capability.MANAGE_MEMBERS);
        ensureNotLastOwner(storyId, memberUserId);
        memberships.remove(storyId, memberUserId);
        return memberships.listForStory(storyId);
    }

    private void ensureNotLastOwner(long storyId, long memberUserId) {
        Role currentRole = memberships.roleFor(memberUserId, storyId).orElse(null);
        if (currentRole != Role.OWNER) {
            return;
        }
        long ownerCount = memberships.listForStory(storyId).stream()
                .filter(m -> m.role() == Role.OWNER)
                .count();
        if (ownerCount <= 1) {
            throw new BadRequestException("Cannot remove the last owner of a story");
        }
    }
}