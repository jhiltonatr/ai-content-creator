package com.example.company.core.node;

import com.example.company.core.data.IdKeys;
import com.example.company.core.data.JsonSupport;
import com.example.company.core.domain.NodeKind;
import com.example.company.core.domain.NodeStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public class NodeRepository {

    private final JdbcClient jdbc;
    private final JsonSupport json;

    public NodeRepository(JdbcClient jdbc, JsonSupport json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    private static final String COLUMNS = """
            id, story_id, parent_id, node_type, title, sort_order, language, status,
            body, script, meta, version, last_change_id, created_at, updated_at, updated_by
            """;

    private static final String FROM = " FROM nodes ";

    public Optional<NodeFull> findById(long storyId, long id) {
        return jdbc.sql("SELECT " + COLUMNS + FROM + "WHERE id = :id AND story_id = :storyId")
                .param("id", id)
                .param("storyId", storyId)
                .query(this::map)
                .optional();
    }

    public List<NodeFull> listForStory(long storyId) {
        return jdbc.sql("SELECT " + COLUMNS + FROM + "WHERE story_id = :storyId ORDER BY sort_order, id")
                .param("storyId", storyId)
                .query(this::map)
                .list();
    }

    public long nextSortOrder(long storyId, Long parentId) {
        Integer max = jdbc.sql("""
                    SELECT COALESCE(MAX(sort_order), 0)
                    FROM nodes
                    WHERE story_id = :storyId
                      AND ((:parentId IS NULL AND parent_id IS NULL) OR parent_id = :parentId)
                """)
                .param("storyId", storyId)
                .param("parentId", parentId)
                .query(Integer.class)
                .optional()
                .orElse(0);
        return max == null ? 0 : (long) max + 10;
    }

    public NodeFull insert(long storyId,
                           Long parentId,
                           NodeKind kind,
                           String title,
                           int sortOrder,
                           String language,
                           NodeStatus status,
                           tools.jackson.databind.JsonNode body,
                           tools.jackson.databind.JsonNode script,
                           tools.jackson.databind.JsonNode meta,
                           long userId) {
        GeneratedKeyHolder keyHolder = new GeneratedKeyHolder();
        jdbc.sql("""
                    INSERT INTO nodes (story_id, parent_id, node_type, title, sort_order, language, status,
                                       body, script, meta, created_by, updated_by)
                    VALUES (:storyId, :parentId, :nodeType, :title, :sortOrder, :language, :status,
                            :body, :script, :meta, :userId, :userId)
                """)
                .param("storyId", storyId)
                .param("parentId", parentId)
                .param("nodeType", kind.name())
                .param("title", title.trim())
                .param("sortOrder", sortOrder)
                .param("language", language)
                .param("status", status.name())
                .param("body", json.write(body))
                .param("script", json.write(script))
                .param("meta", json.write(meta))
                .param("userId", userId)
                .update(keyHolder);
        return findById(storyId, IdKeys.id(keyHolder)).orElseThrow();
    }

    public Optional<NodeFull> updateMetadata(long storyId,
                                             long id,
                                             long expectedVersion,
                                             String changeId,
                                             String title,
                                             NodeKind kind,
                                             Long parentId,
                                             Integer sortOrder,
                                             String language,
                                             NodeStatus status,
                                             long userId) {
        int updated = jdbc.sql("""
                    UPDATE nodes
                    SET title = :title,
                        node_type = :nodeType,
                        parent_id = :parentId,
                        sort_order = :sortOrder,
                        language = :language,
                        status = :status,
                        version = version + 1,
                        updated_by = :userId,
                        updated_at = CURRENT_TIMESTAMP,
                        last_change_id = :changeId
                    WHERE id = :id AND story_id = :storyId AND version = :expectedVersion
                """)
                .param("title", title)
                .param("nodeType", kind.name())
                .param("parentId", parentId)
                .param("sortOrder", sortOrder)
                .param("language", language)
                .param("status", status.name())
                .param("changeId", changeId)
                .param("id", id)
                .param("storyId", storyId)
                .param("expectedVersion", expectedVersion)
                .param("userId", userId)
                .update();
        return updated == 0 ? Optional.empty() : findById(storyId, id);
    }

    public Optional<NodeFull> updateBody(long storyId,
                                         long id,
                                         long expectedVersion,
                                         String changeId,
                                         tools.jackson.databind.JsonNode body,
                                         long userId) {
        int updated = jdbc.sql("""
                    UPDATE nodes
                    SET body = :body, version = version + 1,
                        updated_by = :userId, updated_at = CURRENT_TIMESTAMP, last_change_id = :changeId
                    WHERE id = :id AND story_id = :storyId AND version = :expectedVersion
                """)
                .param("body", json.write(body))
                .param("changeId", changeId)
                .param("id", id)
                .param("storyId", storyId)
                .param("expectedVersion", expectedVersion)
                .param("userId", userId)
                .update();
        return updated == 0 ? Optional.empty() : findById(storyId, id);
    }

    public Optional<NodeFull> updateScript(long storyId,
                                           long id,
                                           long expectedVersion,
                                           String changeId,
                                           tools.jackson.databind.JsonNode script,
                                           long userId) {
        int updated = jdbc.sql("""
                    UPDATE nodes
                    SET script = :script, version = version + 1,
                        updated_by = :userId, updated_at = CURRENT_TIMESTAMP, last_change_id = :changeId
                    WHERE id = :id AND story_id = :storyId AND version = :expectedVersion
                """)
                .param("script", json.write(script))
                .param("changeId", changeId)
                .param("id", id)
                .param("storyId", storyId)
                .param("expectedVersion", expectedVersion)
                .param("userId", userId)
                .update();
        return updated == 0 ? Optional.empty() : findById(storyId, id);
    }

    public Optional<NodeFull> updateMeta(long storyId,
                                         long id,
                                         long expectedVersion,
                                         String changeId,
                                         tools.jackson.databind.JsonNode meta,
                                         long userId) {
        int updated = jdbc.sql("""
                    UPDATE nodes
                    SET meta = :meta, version = version + 1,
                        updated_by = :userId, updated_at = CURRENT_TIMESTAMP, last_change_id = :changeId
                    WHERE id = :id AND story_id = :storyId AND version = :expectedVersion
                """)
                .param("meta", json.write(meta))
                .param("changeId", changeId)
                .param("id", id)
                .param("storyId", storyId)
                .param("expectedVersion", expectedVersion)
                .param("userId", userId)
                .update();
        return updated == 0 ? Optional.empty() : findById(storyId, id);
    }

    public void delete(long id) {
        jdbc.sql("DELETE FROM nodes WHERE id = :id").param("id", id).update();
    }

    private NodeFull map(java.sql.ResultSet rs, int rowNum) throws java.sql.SQLException {
        return new NodeFull(
                rs.getLong("id"),
                rs.getLong("story_id"),
                (Long) rs.getObject("parent_id"),
                NodeKind.valueOf(rs.getString("node_type")),
                rs.getString("title"),
                rs.getInt("sort_order"),
                rs.getString("language"),
                NodeStatus.valueOf(rs.getString("status")),
                json.parse(rs.getString("body")),
                json.parse(rs.getString("script")),
                json.parse(rs.getString("meta")),
                rs.getLong("version"),
                rs.getString("last_change_id"),
                rs.getTimestamp("created_at").toInstant(),
                rs.getTimestamp("updated_at").toInstant(),
                rs.getLong("updated_by"));
    }
}