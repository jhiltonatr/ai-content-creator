package com.example.company.core.auth;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.Optional;

@Repository
public class TokenRepository {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final int TOKEN_BYTES = 32;

    private final JdbcClient jdbc;

    public TokenRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public static String generateToken() {
        byte[] bytes = new byte[TOKEN_BYTES];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    public static String hashToken(String token) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }

    public Optional<AuthTokenRecord> findByHash(String hash) {
        return jdbc.sql("SELECT id, user_id, expires_at FROM auth_tokens WHERE token_hash = :hash")
                .param("hash", hash)
                .query((rs, rowNum) -> new AuthTokenRecord(
                        rs.getLong("id"),
                        rs.getLong("user_id"),
                        rs.getTimestamp("expires_at").toInstant()))
                .optional();
    }

    public void insert(long userId, String hash, Instant expiresAt) {
        jdbc.sql("INSERT INTO auth_tokens (token_hash, user_id, expires_at, created_at) "
                        + "VALUES (:hash, :userId, :expiresAt, CURRENT_TIMESTAMP)")
                .param("hash", hash)
                .param("userId", userId)
                .param("expiresAt", java.sql.Timestamp.from(expiresAt))
                .update();
    }

    public void delete(long userId, String hash) {
        jdbc.sql("DELETE FROM auth_tokens WHERE user_id = :userId AND token_hash = :hash")
                .param("userId", userId)
                .param("hash", hash)
                .update();
    }

    public void deleteAllForUser(long userId) {
        jdbc.sql("DELETE FROM auth_tokens WHERE user_id = :userId")
                .param("userId", userId)
                .update();
    }

    public void deleteExpired() {
        jdbc.sql("DELETE FROM auth_tokens WHERE expires_at <= CURRENT_TIMESTAMP").update();
    }
}