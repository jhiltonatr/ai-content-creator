package com.example.company.core.user;

import com.example.company.core.web.CurrentUserId;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class UserController {

    private final UserService users;

    public UserController(UserService users) {
        this.users = users;
    }

    @GetMapping("/me")
    public MeResponse me(@CurrentUserId Long userId) {
        return users.me(userId);
    }

    @PutMapping("/me")
    public MeResponse.UserInfo updateProfile(@CurrentUserId Long userId, @Valid @RequestBody UpdateProfileRequest request) {
        return users.updateProfile(userId, request);
    }

    @PostMapping("/me/password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void changePassword(@CurrentUserId Long userId, @Valid @RequestBody ChangePasswordRequest request) {
        users.changePassword(userId, request);
    }

    @GetMapping("/me/settings")
    public UserSettings settings(@CurrentUserId Long userId) {
        return users.getSettings(userId);
    }

    @PutMapping("/me/settings")
    public UserSettings saveSettings(@CurrentUserId Long userId, @Valid @RequestBody SaveSettingsRequest request) {
        return users.saveSettings(userId, request);
    }
}