package com.example.company.core.user;

import com.example.company.core.membership.MembershipRepository;
import com.example.company.core.story.StoryRepository;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class UserService {

    private final UserRepository users;
    private final StoryRepository stories;
    private final MembershipRepository memberships;

    public UserService(UserRepository users, StoryRepository stories, MembershipRepository memberships) {
        this.users = users;
        this.stories = stories;
        this.memberships = memberships;
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
                new MeResponse.UserInfo(user.id(), user.email(), user.displayName()),
                roles);
    }

    public UserRecord findOrCreate(FindOrCreateUserRequest request) {
        return users.findByEmail(request.email())
                .orElseGet(() -> users.create(request.email(), request.displayName()));
    }
}