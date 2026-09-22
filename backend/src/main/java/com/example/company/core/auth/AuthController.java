package com.example.company.core.auth;

import com.example.company.core.web.AuthFilter;
import com.example.company.core.web.CoreProperties;
import com.example.company.core.web.CurrentUserId;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService auth;
    private final CoreProperties properties;

    public AuthController(AuthService auth, CoreProperties properties) {
        this.auth = auth;
        this.properties = properties;
    }

    @PostMapping("/login")
    public AuthService.LoginResponse login(@Valid @RequestBody AuthService.LoginRequest request) {
        return auth.login(request.email(), request.password(), properties.tokenTtl());
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(@CurrentUserId Long userId, HttpServletRequest request) {
        auth.logout(userId, (String) request.getAttribute(AuthFilter.ATTR_TOKEN_HASH));
    }
}