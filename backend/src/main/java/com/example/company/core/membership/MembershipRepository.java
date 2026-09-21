package com.example.company.core.membership;

import com.example.company.core.domain.Role;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public class MembershipRepository {

    private final JdbcClient jdbc;

    public MembershipRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<Role> roleFor(long userId, long storyId) {
        return jdbc.sql("SELECT role FROM memberships WHERE user_id = :userId AND story_id = :storyId")
                .param("userId", userId)
                .param("storyId", storyId)
                .query((rs, rowNum) -> Role.valueOf(rs.getString("role")))
                .optional();
    }

    public List<MembershipRecord> listForStory(long storyId) {
        return jdbc.sql("""
                    SELECT m.id, m.story_id, m.user_id, m.role, m.created_at, u.email, u.display_name
                    FROM memberships m
                    JOIN users u ON u.id = m.user_id
                    WHERE m.story_id = :storyId
                    ORDER BY m.created_at
                """)
                .param("storyId", storyId)
                .query((rs, rowNum) -> new MembershipRecord(
                        rs.getLong("id"),
                        rs.getLong("story_id"),
                        rs.getLong("user_id"),
                        Role.valueOf(rs.getString("role")),
                        rs.getTimestamp("created_at").toInstant(),
                        rs.getString("email"),
                        rs.getString("display_name")))
                .list();
    }

    public int upsert(long storyId, long userId, Role role) {
        Long existingId = jdbc.sql("""
                    SELECT id FROM memberships
                    WHERE story_id = :storyId AND user_id = :userId
                """)
                .param("storyId", storyId)
                .param("userId", userId)
                .query(Long.class)
                .optional()
                .orElse(null);
        if (existingId != null) {
            return jdbc.sql("UPDATE memberships SET role = :role WHERE id = :id")
                    .param("role", role.name())
                    .param("id", existingId)
                    .update();
        }
        return jdbc.sql("INSERT INTO memberships (story_id, user_id, role) VALUES (:storyId, :userId, :role)")
                .param("storyId", storyId)
                .param("userId", userId)
                .param("role", role.name())
                .update();
    }

    public int remove(long storyId, long userId) {
        return jdbc.sql("DELETE FROM memberships WHERE story_id = :storyId AND user_id = :userId")
                .param("storyId", storyId)
                .param("userId", userId)
                .update();
    }
}