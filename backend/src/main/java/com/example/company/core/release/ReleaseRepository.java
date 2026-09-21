package com.example.company.core.release;

import com.example.company.core.data.IdKeys;
import com.example.company.core.data.JsonSupport;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import tools.jackson.databind.JsonNode;

@Repository
public class ReleaseRepository {

    private final JdbcClient jdbc;
    private final JsonSupport json;

    public ReleaseRepository(JdbcClient jdbc, JsonSupport json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    private static final String COLUMNS = "id, story_id, version, name, notes, created_by, published_at, nodes";

    public List<ReleaseRecord> listForStory(long storyId) {
        return jdbc.sql("SELECT " + COLUMNS + " FROM releases WHERE story_id = :storyId ORDER BY version DESC")
                .param("storyId", storyId)
                .query(this::map)
                .list();
    }

    public Optional<ReleaseRecord> findById(long storyId, long id) {
        return jdbc.sql("SELECT " + COLUMNS + " FROM releases WHERE id = :id AND story_id = :storyId")
                .param("id", id)
                .param("storyId", storyId)
                .query(this::map)
                .optional();
    }

    public Optional<ReleaseRecord> findByVersion(long storyId, int version) {
        return jdbc.sql("SELECT " + COLUMNS + " FROM releases WHERE story_id = :storyId AND version = :version")
                .param("storyId", storyId)
                .param("version", version)
                .query(this::map)
                .optional();
    }

    public int nextVersion(long storyId) {
        Integer max = jdbc.sql("SELECT COALESCE(MAX(version), 0) FROM releases WHERE story_id = :storyId")
                .param("storyId", storyId)
                .query(Integer.class)
                .optional()
                .orElse(0);
        return (max == null ? 0 : max) + 1;
    }

    public ReleaseRecord insert(long storyId, int version, String name, String notes, long userId, JsonNode nodes) {
        GeneratedKeyHolder keyHolder = new GeneratedKeyHolder();
        jdbc.sql("""
                    INSERT INTO releases (story_id, version, name, notes, created_by, nodes)
                    VALUES (:storyId, :version, :name, :notes, :userId, :nodes)
                """)
                .param("storyId", storyId)
                .param("version", version)
                .param("name", name.trim())
                .param("notes", notes == null || notes.isBlank() ? null : notes.trim())
                .param("userId", userId)
                .param("nodes", json.write(nodes))
                .update(keyHolder);
        long id = IdKeys.id(keyHolder);
        return findById(storyId, id).orElseThrow();
    }

    private ReleaseRecord map(java.sql.ResultSet rs, int rowNum) throws java.sql.SQLException {
        return new ReleaseRecord(
                rs.getLong("id"),
                rs.getLong("story_id"),
                rs.getInt("version"),
                rs.getString("name"),
                rs.getString("notes"),
                rs.getLong("created_by"),
                rs.getTimestamp("published_at").toInstant(),
                json.parse(rs.getString("nodes")));
    }
}