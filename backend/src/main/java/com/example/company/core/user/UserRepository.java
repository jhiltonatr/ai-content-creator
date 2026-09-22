package com.example.company.core.user;

import com.example.company.core.common.NotFoundException;
import com.example.company.core.data.IdKeys;
import com.example.company.core.data.JsonSupport;
import com.example.company.core.domain.SystemRole;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public class UserRepository {

    private final JdbcClient jdbc;
    private final JsonSupport json;

    public UserRepository(JdbcClient jdbc, JsonSupport json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    private static final String COLUMNS =
            "id, email, display_name, enabled, system_role, password_hash, created_at, settings";

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

    public Optional<UserRecord> findEnabledByEmail(String email) {
        return jdbc.sql("SELECT " + COLUMNS
                        + " FROM users WHERE lower(email) = lower(:email) AND enabled = TRUE")
                .param("email", email.trim())
                .query(this::map)
                .optional();
    }

    public List<UserRecord> list() {
        return jdbc.sql("SELECT " + COLUMNS + " FROM users ORDER BY lower(email)")
                .query(this::map)
                .list();
    }

    public UserRecord create(String email, String displayName) {
        return create(email, displayName, null);
    }

    public UserRecord create(String email, String displayName, String passwordHash) {
        GeneratedKeyHolder keyHolder = new GeneratedKeyHolder();
        jdbc.sql("INSERT INTO users (email, display_name, password_hash) VALUES (:email, :displayName, :passwordHash)")
                .param("email", email.trim())
                .param("displayName", (displayName == null || displayName.isBlank()) ? email.trim() : displayName.trim())
                .param("passwordHash", passwordHash)
                .update(keyHolder);
        return require(IdKeys.id(keyHolder));
    }

    public void updateIdentity(long id, String email, String displayName) {
        jdbc.sql("""
                    UPDATE users
                    SET email = :email, display_name = :displayName
                    WHERE id = :id
                """)
                .param("email", email.trim())
                .param("displayName", (displayName == null || displayName.isBlank()) ? email.trim() : displayName.trim())
                .param("id", id)
                .update();
    }

    public void setEnabled(long id, boolean enabled) {
        jdbc.sql("UPDATE users SET enabled = :enabled WHERE id = :id")
                .param("enabled", enabled)
                .param("id", id)
                .update();
    }

    public void setSystemRole(long id, SystemRole systemRole) {
        jdbc.sql("UPDATE users SET system_role = :systemRole WHERE id = :id")
                .param("systemRole", systemRole.name())
                .param("id", id)
                .update();
    }

    public void setPasswordHash(long id, String passwordHash) {
        jdbc.sql("UPDATE users SET password_hash = :passwordHash WHERE id = :id")
                .param("passwordHash", passwordHash)
                .param("id", id)
                .update();
    }

    public void setSettings(long id, tools.jackson.databind.JsonNode settings) {
        jdbc.sql("UPDATE users SET settings = :settings WHERE id = :id")
                .param("settings", json.write(settings))
                .param("id", id)
                .update();
    }

    public void backfillMissingPasswords(String passwordHash) {
        jdbc.sql("UPDATE users SET password_hash = :passwordHash WHERE password_hash IS NULL")
                .param("passwordHash", passwordHash)
                .update();
    }

    public long countEnabledAdmins() {
        return jdbc.sql("SELECT COUNT(*) FROM users WHERE system_role = 'ADMIN' AND enabled = TRUE")
                .query((rs, rowNum) -> rs.getLong(1))
                .single();
    }

    public void delete(long id) {
        jdbc.sql("DELETE FROM users WHERE id = :id").param("id", id).update();
    }

    private UserRecord map(java.sql.ResultSet rs, int rowNum) throws java.sql.SQLException {
        return new UserRecord(
                rs.getLong("id"),
                rs.getString("email"),
                rs.getString("display_name"),
                rs.getBoolean("enabled"),
                SystemRole.valueOf(rs.getString("system_role")),
                rs.getString("password_hash"),
                rs.getTimestamp("created_at").toInstant(),
                json.parse(rs.getString("settings")));
    }
}