package com.example.company.core.lore;

import com.example.company.core.data.IdKeys;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public class LoreRepository {

    private final JdbcClient jdbc;

    public LoreRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    private static final String COLUMNS = "id, story_id, title, category, body, created_at, updated_at";

    public List<LoreRecord> listForStory(long storyId) {
        return jdbc.sql("SELECT " + COLUMNS + " FROM lore_entries WHERE story_id = :storyId ORDER BY title")
                .param("storyId", storyId)
                .query(this::map)
                .list();
    }

    public Optional<LoreRecord> findById(long storyId, long id) {
        return jdbc.sql("SELECT " + COLUMNS + " FROM lore_entries WHERE id = :id AND story_id = :storyId")
                .param("id", id)
                .param("storyId", storyId)
                .query(this::map)
                .optional();
    }

    public boolean exists(long storyId, long id) {
        return findById(storyId, id).isPresent();
    }

    public LoreRecord insert(long storyId, String title, String category, String body, long userId) {
        GeneratedKeyHolder keyHolder = new GeneratedKeyHolder();
        jdbc.sql("""
                    INSERT INTO lore_entries (story_id, title, category, body, created_by, updated_by)
                    VALUES (:storyId, :title, :category, :body, :userId, :userId)
                """)
                .param("storyId", storyId)
                .param("title", title.trim())
                .param("category", category)
                .param("body", body)
                .param("userId", userId)
                .update(keyHolder);
        long id = IdKeys.id(keyHolder);
        return findById(storyId, id).orElseThrow();
    }

    public Optional<LoreRecord> update(long storyId, long id, String title, String category, String body, long userId) {
        int updated = jdbc.sql("""
                    UPDATE lore_entries
                    SET title = :title, category = :category, body = :body,
                        updated_by = :userId, updated_at = CURRENT_TIMESTAMP
                    WHERE id = :id AND story_id = :storyId
                """)
                .param("title", title.trim())
                .param("category", category)
                .param("body", body)
                .param("userId", userId)
                .param("id", id)
                .param("storyId", storyId)
                .update();
        return updated == 0 ? Optional.empty() : findById(storyId, id);
    }

    public void delete(long storyId, long id) {
        jdbc.sql("DELETE FROM lore_entries WHERE id = :id AND story_id = :storyId")
                .param("id", id)
                .param("storyId", storyId)
                .update();
    }

    private LoreRecord map(java.sql.ResultSet rs, int rowNum) throws java.sql.SQLException {
        return new LoreRecord(
                rs.getLong("id"),
                rs.getLong("story_id"),
                rs.getString("title"),
                rs.getString("category"),
                rs.getString("body"),
                rs.getTimestamp("created_at").toInstant(),
                rs.getTimestamp("updated_at").toInstant());
    }
}