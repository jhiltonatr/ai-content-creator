package com.example.company.core.user;

import com.example.company.core.auth.PasswordHasher;
import com.example.company.core.auth.TokenRepository;
import com.example.company.core.common.BadRequestException;
import com.example.company.core.common.ConflictException;
import com.example.company.core.membership.MembershipRepository;
import com.example.company.core.story.StoryRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class UserService {

    private final UserRepository users;
    private final StoryRepository stories;
    private final MembershipRepository memberships;
    private final PasswordHasher passwords;
    private final TokenRepository tokens;
    private final JsonMapper mapper;

    public UserService(UserRepository users,
                       StoryRepository stories,
                       MembershipRepository memberships,
                       PasswordHasher passwords,
                       TokenRepository tokens,
                       JsonMapper mapper) {
        this.users = users;
        this.stories = stories;
        this.memberships = memberships;
        this.passwords = passwords;
        this.tokens = tokens;
        this.mapper = mapper;
    }

    public MeResponse me(long userId) {
        UserRecord user = users.require(userId);
        var myStories = stories.listForUser(userId);
        Map<Long, Integer> memberCounts = myStories.stream()
                .collect(Collectors.toMap(story -> story.id(), story -> memberships.listForStory(story.id()).size()));
        List<MeResponse.StoryRole> roles = new ArrayList<>();
        for (var story : myStories) {
            roles.add(new MeResponse.StoryRole(story.id(), story.title(), story.storyType(), story.myRole(),
                    memberCounts.getOrDefault(story.id(), 0)));
        }
        return new MeResponse(
                new MeResponse.UserInfo(user.id(), user.email(), user.displayName(), user.systemRole()),
                roles);
    }

    @Transactional
    public MeResponse.UserInfo updateProfile(long userId, UpdateProfileRequest request) {
        UserRecord user = users.require(userId);
        String email = request.email() == null || request.email().isBlank()
                ? user.email() : request.email().trim();
        String displayName = request.displayName() == null || request.displayName().isBlank()
                ? user.displayName() : request.displayName().trim();
        if (!email.equalsIgnoreCase(user.email()) && users.findByEmail(email).isPresent()) {
            throw new ConflictException("A user with this email already exists");
        }
        users.updateIdentity(userId, email, displayName);
        UserRecord saved = users.require(userId);
        return new MeResponse.UserInfo(saved.id(), saved.email(), saved.displayName(), saved.systemRole());
    }

    @Transactional
    public void changePassword(long userId, ChangePasswordRequest request) {
        UserRecord user = users.require(userId);
        if (!passwords.matches(request.currentPassword(), user.passwordHash())) {
            throw new BadRequestException("Current password is incorrect");
        }
        users.setPasswordHash(userId, passwords.encode(request.newPassword()));
        tokens.deleteAllForUser(userId);
    }

    public UserSettings getSettings(long userId) {
        return toSettings(users.require(userId).settings());
    }

    @Transactional
    public UserSettings saveSettings(long userId, SaveSettingsRequest request) {
        UserRecord user = users.require(userId);
        UserSettings current = toSettings(user.settings());
        String language = request.language() == null
                ? current.language()
                : (request.language().isBlank() ? null : request.language().trim());
        UserSettings.Theme theme = request.theme() == null ? current.theme() : request.theme();
        UserSettings next = new UserSettings(language, theme);
        users.setSettings(userId, mapper.valueToTree(next));
        return next;
    }

    private UserSettings toSettings(JsonNode node) {
        if (node == null || node.isNull() || !node.isObject()) {
            return UserSettings.empty();
        }
        try {
            UserSettings settings = mapper.convertValue(node, UserSettings.class);
            return settings == null ? UserSettings.empty() : settings;
        } catch (RuntimeException e) {
            return UserSettings.empty();
        }
    }
}