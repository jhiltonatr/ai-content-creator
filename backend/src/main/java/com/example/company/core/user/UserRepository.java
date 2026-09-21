package com.example.company.core.user;

import com.example.company.core.common.NotFoundException;
import com.example.company.core.data.IdKeys;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public class UserRepository {

    private final JdbcClient jdbc;

    public UserRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    private static final String COLUMNS = "id, email, display_name, created_at";

    public Optional<UserRecord> findById(long id) {
        return jdbc.sql("SELECT " + COLUMNS + " FROM users WHERE id = :id")
                .param("id", id)
                .query(this::map)
                .optional();
    }

    public UserRecord require(long id) {
        return findById(id).orElseThrow(() -> new NotFoundException("User " + id + " not found"));
    }

    public Optional<UserRecord> findByEmail(String email) {
        return jdbc.sql("SELECT " + COLUMNS + " FROM users WHERE lower(email) = lower(:email)")
                .param("email", email.trim())
                .query(this::map)
                .optional();
    }

    public UserRecord create(String email, String displayName) {
        GeneratedKeyHolder keyHolder = new GeneratedKeyHolder();
        jdbc.sql("INSERT INTO users (email, display_name) VALUES (:email, :displayName)")
                .param("email", email.trim())
                .param("displayName", (displayName == null || displayName.isBlank()) ? email.trim() : displayName.trim())
                .update(keyHolder);
        return require(IdKeys.id(keyHolder));
    }

    private UserRecord map(java.sql.ResultSet rs, int rowNum) throws java.sql.SQLException {
        return new UserRecord(
                rs.getLong("id"),
                rs.getString("email"),
                rs.getString("display_name"),
                rs.getTimestamp("created_at").toInstant());
    }
}