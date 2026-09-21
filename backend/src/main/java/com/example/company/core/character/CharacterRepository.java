package com.example.company.core.character;

import com.example.company.core.data.IdKeys;
import com.example.company.core.data.JsonSupport;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import tools.jackson.databind.JsonNode;

@Repository
public class CharacterRepository {

    private final JdbcClient jdbc;
    private final JsonSupport json;

    public CharacterRepository(JdbcClient jdbc, JsonSupport json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    private static final String COLUMNS = "id, story_id, name, attributes, bio, notes, created_at, updated_at";

    public List<CharacterRecord> listForStory(long storyId) {
        return jdbc.sql("SELECT " + COLUMNS + " FROM characters WHERE story_id = :storyId ORDER BY name")
                .param("storyId", storyId)
                .query(this::map)
                .list();
    }

    public Optional<CharacterRecord> findById(long storyId, long id) {
        return jdbc.sql("SELECT " + COLUMNS + " FROM characters WHERE id = :id AND story_id = :storyId")
                .param("id", id)
                .param("storyId", storyId)
                .query(this::map)
                .optional();
    }

    public boolean exists(long storyId, long id) {
        return findById(storyId, id).isPresent();
    }

    public CharacterRecord insert(long storyId, String name, JsonNode attributes, String bio, String notes, long userId) {
        GeneratedKeyHolder keyHolder = new GeneratedKeyHolder();
        jdbc.sql("""
                    INSERT INTO characters (story_id, name, attributes, bio, notes, created_by, updated_by)
                    VALUES (:storyId, :name, :attributes, :bio, :notes, :userId, :userId)
                """)
                .param("storyId", storyId)
                .param("name", name.trim())
                .param("attributes", json.write(attributes))
                .param("bio", bio)
                .param("notes", notes)
                .param("userId", userId)
                .update(keyHolder);
        long id = IdKeys.id(keyHolder);
        return findById(storyId, id).orElseThrow();
    }

    public Optional<CharacterRecord> update(long storyId, long id, String name, JsonNode attributes, String bio, String notes, long userId) {
        int updated = jdbc.sql("""
                    UPDATE characters
                    SET name = :name, attributes = :attributes, bio = :bio, notes = :notes,
                        updated_by = :userId, updated_at = CURRENT_TIMESTAMP
                    WHERE id = :id AND story_id = :storyId
                """)
                .param("name", name.trim())
                .param("attributes", json.write(attributes))
                .param("bio", bio)
                .param("notes", notes)
                .param("userId", userId)
                .param("id", id)
                .param("storyId", storyId)
                .update();
        return updated == 0 ? Optional.empty() : findById(storyId, id);
    }

    public void delete(long storyId, long id) {
        jdbc.sql("DELETE FROM characters WHERE id = :id AND story_id = :storyId")
                .param("id", id)
                .param("storyId", storyId)
                .update();
    }

    private CharacterRecord map(java.sql.ResultSet rs, int rowNum) throws java.sql.SQLException {
        return new CharacterRecord(
                rs.getLong("id"),
                rs.getLong("story_id"),
                rs.getString("name"),
                json.parse(rs.getString("attributes")),
                rs.getString("bio"),
                rs.getString("notes"),
                rs.getTimestamp("created_at").toInstant(),
                rs.getTimestamp("updated_at").toInstant());
    }
}