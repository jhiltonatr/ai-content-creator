package com.example.company.core.admin;

import com.example.company.core.auth.PasswordHasher;
import com.example.company.core.auth.TokenRepository;
import com.example.company.core.common.BadRequestException;
import com.example.company.core.common.ConflictException;
import com.example.company.core.common.ForbiddenException;
import com.example.company.core.domain.SystemRole;
import com.example.company.core.story.StoryRepository;
import com.example.company.core.user.UserRecord;
import com.example.company.core.user.UserRepository;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class AdminUserService {

    private final UserRepository users;
    private final StoryRepository stories;
    private final PasswordHasher passwords;
    private final TokenRepository tokens;

    public AdminUserService(UserRepository users,
                            StoryRepository stories,
                            PasswordHasher passwords,
                            TokenRepository tokens) {
        this.users = users;
        this.stories = stories;
        this.passwords = passwords;
        this.tokens = tokens;
    }

    public List<AdminUserView> list(long actorId) {
        requireAdmin(actorId);
        return users.list().stream().map(AdminUserService::view).toList();
    }

    @Transactional
    public AdminUserView create(long actorId, CreateUserRequest request) {
        requireAdmin(actorId);
        if (users.findByEmail(request.email()).isPresent()) {
            throw new ConflictException("A user with this email already exists");
        }
        SystemRole role = request.systemRole() == null ? SystemRole.USER : request.systemRole();
        UserRecord user;
        try {
            user = users.create(request.email(), request.displayName(), passwords.encode(request.password()));
            users.setSystemRole(user.id(), role);
        } catch (DuplicateKeyException e) {
            throw new ConflictException("A user with this email already exists");
        }
        return view(users.require(user.id()));
    }

    @Transactional
    public AdminUserView update(long actorId, long userId, UpdateUserRequest request) {
        requireAdmin(actorId);
        UserRecord target = users.require(userId);
        Boolean wantsEnabledChange = request.enabled() != null && target.enabled() != request.enabled();
        SystemRole wantsNewRole = request.systemRole() == null ? target.systemRole() : request.systemRole();
        boolean roleChanged = wantsNewRole != target.systemRole();

        if (actorId == userId && (wantsEnabledChange || roleChanged)) {
            throw new BadRequestException("You cannot change your own system role or enabled state");
        }
        boolean disabling = wantsEnabledChange && !request.enabled();
        boolean demoting = roleChanged && wantsNewRole != SystemRole.ADMIN;
        if ((disabling || demoting) && target.systemRole() == SystemRole.ADMIN && users.countEnabledAdmins() <= 1) {
            throw new ConflictException("Cannot disable or demote the last enabled administrator");
        }

        if (request.email() != null && !request.email().trim().equalsIgnoreCase(target.email())) {
            if (users.findByEmail(request.email()).isPresent()) {
                throw new ConflictException("A user with this email already exists");
            }
        }
        users.updateIdentity(userId,
                request.email() == null ? target.email() : request.email(),
                request.displayName() == null ? target.displayName() : request.displayName());
        if (roleChanged) {
            users.setSystemRole(userId, wantsNewRole);
        }
        if (wantsEnabledChange) {
            users.setEnabled(userId, request.enabled());
            if (disabling) {
                tokens.deleteAllForUser(userId);
            }
        }
        return view(users.require(userId));
    }

    @Transactional
    public AdminUserView resetPassword(long actorId, long userId, ResetPasswordRequest request) {
        requireAdmin(actorId);
        users.require(userId);
        users.setPasswordHash(userId, passwords.encode(request.password()));
        tokens.deleteAllForUser(userId);
        return view(users.require(userId));
    }

    @Transactional
    public void delete(long actorId, long userId) {
        requireAdmin(actorId);
        if (actorId == userId) {
            throw new BadRequestException("You cannot delete your own account");
        }
        UserRecord target = users.require(userId);
        if (target.systemRole() == SystemRole.ADMIN && users.countEnabledAdmins() <= 1) {
            throw new ConflictException("Cannot delete the last enabled administrator");
        }
        long owned = stories.countOwnedBy(userId);
        if (owned > 0) {
            throw new ConflictException("User owns " + owned
                    + (owned == 1 ? " story" : " stories") + "; disable the user instead");
        }
        users.delete(userId);
    }

    private UserRecord requireAdmin(long actorId) {
        UserRecord actor = users.require(actorId);
        if (actor.systemRole() != SystemRole.ADMIN) {
            throw new ForbiddenException("Administrator access required");
        }
        return actor;
    }

    private static AdminUserView view(UserRecord user) {
        return new AdminUserView(user.id(), user.email(), user.displayName(),
                user.systemRole(), user.enabled(), user.createdAt());
    }
}