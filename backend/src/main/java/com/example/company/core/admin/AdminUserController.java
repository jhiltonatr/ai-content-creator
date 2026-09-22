package com.example.company.core.admin;

import com.example.company.core.web.CurrentUserId;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/admin/users")
public class AdminUserController {

    private final AdminUserService admin;

    public AdminUserController(AdminUserService admin) {
        this.admin = admin;
    }

    @GetMapping
    public List<AdminUserView> list(@CurrentUserId Long actorId) {
        return admin.list(actorId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public AdminUserView create(@CurrentUserId Long actorId, @Valid @RequestBody CreateUserRequest request) {
        return admin.create(actorId, request);
    }

    @PutMapping("/{userId}")
    public AdminUserView update(@CurrentUserId Long actorId,
                                @PathVariable long userId,
                                @Valid @RequestBody UpdateUserRequest request) {
        return admin.update(actorId, userId, request);
    }

    @PostMapping("/{userId}/password")
    public AdminUserView resetPassword(@CurrentUserId Long actorId,
                                       @PathVariable long userId,
                                       @Valid @RequestBody ResetPasswordRequest request) {
        return admin.resetPassword(actorId, userId, request);
    }

    @DeleteMapping("/{userId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@CurrentUserId Long actorId, @PathVariable long userId) {
        admin.delete(actorId, userId);
    }
}