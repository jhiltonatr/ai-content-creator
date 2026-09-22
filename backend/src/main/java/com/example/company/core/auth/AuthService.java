package com.example.company.core.auth;

import com.example.company.core.common.ForbiddenException;
import com.example.company.core.common.UnauthorizedException;
import com.example.company.core.user.MeResponse;
import com.example.company.core.user.UserRecord;
import com.example.company.core.user.UserRepository;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;

@Service
public class AuthService {

    private static final Duration DEFAULT_TTL = Duration.ofDays(7);

    private final UserRepository users;
    private final TokenRepository tokens;
    private final PasswordHasher passwords;

    public AuthService(UserRepository users, TokenRepository tokens, PasswordHasher passwords) {
        this.users = users;
        this.tokens = tokens;
        this.passwords = passwords;
    }

    @Transactional
    public LoginResponse login(String email, String password, Duration tokenTtl) {
        tokens.deleteExpired();
        UserRecord user = users.findByEmail(email)
                .orElseThrow(() -> new UnauthorizedException("Invalid email or password"));
        if (!passwords.matches(password, user.passwordHash())) {
            throw new UnauthorizedException("Invalid email or password");
        }
        if (!user.enabled()) {
            throw new ForbiddenException("This account has been disabled");
        }
        long ttlMillis = tokenTtl == null ? DEFAULT_TTL.toMillis() : tokenTtl.toMillis();
        String rawToken = TokenRepository.generateToken();
        tokens.insert(user.id(), TokenRepository.hashToken(rawToken), Instant.now().plusMillis(ttlMillis));
        return new LoginResponse(rawToken, new MeResponse.UserInfo(
                user.id(), user.email(), user.displayName(), user.systemRole()));
    }

    @Transactional
    public void logout(long userId, String rawToken) {
        if (rawToken != null && !rawToken.isBlank()) {
            tokens.delete(userId, TokenRepository.hashToken(rawToken));
        }
    }

    /**
     * Resolves a raw bearer token to an enabled user. Expired, unknown, or
     * disabled-user tokens are rejected (and cleaned up when safe).
     */
    public java.util.Optional<UserRecord> resolve(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            return java.util.Optional.empty();
        }
        String hash = TokenRepository.hashToken(rawToken);
        return tokens.findByHash(hash)
                .flatMap(record -> {
                    if (record.expiresAt().isBefore(Instant.now())) {
                        tokens.delete(record.userId(), hash);
                        return java.util.Optional.<UserRecord>empty();
                    }
                    return users.findById(record.userId())
                            .filter(UserRecord::enabled)
                            .or(() -> {
                                tokens.delete(record.userId(), hash);
                                return java.util.Optional.empty();
                            });
                });
    }

    public boolean userExistsAndEnabled(long userId) {
        return users.findById(userId).map(UserRecord::enabled).orElse(false);
    }

    public record LoginRequest(@NotBlank @Email String email, @NotBlank String password) {
    }

    public record LoginResponse(String token, MeResponse.UserInfo user) {
    }
}