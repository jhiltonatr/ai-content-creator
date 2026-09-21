package com.example.company.core.story;

import com.example.company.core.data.IdKeys;
import com.example.company.core.data.JsonSupport;
import com.example.company.core.domain.Role;
import com.example.company.core.domain.StoryType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public class StoryRepository {

    private final JdbcClient jdbc;
    private final JsonSupport json;

    public StoryRepository(JdbcClient jdbc, JsonSupport json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    private static final String COLUMNS = "id, title, story_type, default_language, synopsis, settings, created_at, updated_at";

    public StoryRecord create(String title,
                              StoryType storyType,
                              String defaultLanguage,
                              String synopsis,
                              tools.jackson.databind.JsonNode settings,
                              long userId) {
        GeneratedKeyHolder keyHolder = new GeneratedKeyHolder();
        jdbc.sql("""
                    INSERT INTO stories (title, story_type, default_language, synopsis, settings, created_by, updated_by)
                    VALUES (:title, :storyType, :defaultLanguage, :synopsis, :settings, :userId, :userId)
                """)
                .param("title", title.trim())
                .param("storyType", storyType.name())
                .param("defaultLanguage", defaultLanguage)
                .param("synopsis", synopsis == null || synopsis.isBlank() ? null : synopsis.trim())
                .param("settings", json.write(settings))
                .param("userId", userId)
                .update(keyHolder);
        long id = IdKeys.id(keyHolder);
        return require(id);
    }

    public Optional<StoryRecord> findById(long id) {
        return jdbc.sql("SELECT " + COLUMNS + " FROM stories WHERE id = :id")
                .param("id", id)
                .query(this::map)
                .optional();
    }

    public StoryRecord require(long id) {
        return findById(id).orElseThrow(() -> new com.example.company.core.common.NotFoundException("Story not found"));
    }

    public List<StoryWithRole> listForUser(long userId) {
        return jdbc.sql("""
                    SELECT s.id, s.title, s.story_type, s.default_language, s.synopsis, s.settings,
                           s.created_at, s.updated_at, m.role
                    FROM stories s
                    JOIN memberships m ON m.story_id = s.id
                    WHERE m.user_id = :userId
                      AND (m.role <> :viewerRole OR EXISTS (
                        SELECT 1 FROM releases r WHERE r.story_id = s.id
                      ))
                    ORDER BY s.updated_at DESC
                """)
                .param("userId", userId)
                .param("viewerRole", Role.VIEWER.name())
                .query((rs, rowNum) -> new StoryWithRole(
                        rs.getLong("id"),
                        rs.getString("title"),
                        StoryType.valueOf(rs.getString("story_type")),
                        rs.getString("default_language"),
                        rs.getString("synopsis"),
                        json.parse(rs.getString("settings")),
                        rs.getTimestamp("created_at").toInstant(),
                        rs.getTimestamp("updated_at").toInstant(),
                        Role.valueOf(rs.getString("role"))))
                .list();
    }

    public StoryRecord update(long storyId,
                              String title,
                              String defaultLanguage,
                              String synopsis,
                              tools.jackson.databind.JsonNode settings,
                              long userId) {
        jdbc.sql("""
                    UPDATE stories
                    SET title = :title, default_language = :defaultLanguage, synopsis = :synopsis,
                        settings = :settings, updated_by = :userId, updated_at = CURRENT_TIMESTAMP
                    WHERE id = :storyId
                """)
                .param("title", title.trim())
                .param("defaultLanguage", defaultLanguage)
                .param("synopsis", synopsis == null || synopsis.isBlank() ? null : synopsis.trim())
                .param("settings", json.write(settings))
                .param("userId", userId)
                .param("storyId", storyId)
                .update();
        return require(storyId);
    }

    public void delete(long id) {
        jdbc.sql("DELETE FROM stories WHERE id = :id").param("id", id).update();
    }

    private StoryRecord map(java.sql.ResultSet rs, int rowNum) throws java.sql.SQLException {
        return new StoryRecord(
                rs.getLong("id"),
                rs.getString("title"),
                StoryType.valueOf(rs.getString("story_type")),
                rs.getString("default_language"),
                rs.getString("synopsis"),
                json.parse(rs.getString("settings")),
                rs.getTimestamp("created_at").toInstant(),
                rs.getTimestamp("updated_at").toInstant());
    }
}