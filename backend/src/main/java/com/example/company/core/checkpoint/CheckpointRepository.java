package com.example.company.core.checkpoint;

import com.example.company.core.data.IdKeys;
import com.example.company.core.data.JsonSupport;
import com.example.company.core.node.WordCounter;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.JsonNode;

import java.util.List;
import java.util.Optional;

@Repository
public class CheckpointRepository {

    private final JdbcClient jdbc;
    private final JsonSupport json;

    public CheckpointRepository(JdbcClient jdbc, JsonSupport json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    // Joins users only for display names; never used to filter rows.
    private static final String COLUMNS = """
            c.id, c.node_id, c.node_version, c.title, c.body, c.script, c.meta,
            c.note, c.created_by, u.display_name AS author_name, c.created_at
            """;

    private static final String FROM = """
            FROM node_checkpoints c
            JOIN users u ON u.id = c.created_by
            """;

    public List<CheckpointRecord> listForNode(long nodeId) {
        return jdbc.sql("SELECT " + COLUMNS + FROM
                        + "WHERE c.node_id = :nodeId ORDER BY c.id DESC")
                .param("nodeId", nodeId)
                .query(this::map)
                .list();
    }

    public Optional<CheckpointRecord> findById(long nodeId, long id) {
        return jdbc.sql("SELECT " + COLUMNS + FROM
                        + "WHERE c.node_id = :nodeId AND c.id = :id")
                .param("nodeId", nodeId)
                .param("id", id)
                .query(this::map)
                .optional();
    }

    public Optional<CheckpointRecord> findByNodeVersion(long nodeId, long version) {
        return jdbc.sql("SELECT " + COLUMNS + FROM
                        + "WHERE c.node_id = :nodeId AND c.node_version = :version ORDER BY c.id DESC LIMIT 1")
                .param("nodeId", nodeId)
                .param("version", version)
                .query(this::map)
                .optional();
    }

    public CheckpointRecord insert(long nodeId,
                                   long nodeVersion,
                                   String title,
                                   JsonNode body,
                                   JsonNode script,
                                   JsonNode meta,
                                   String note,
                                   long userId) {
        GeneratedKeyHolder keyHolder = new GeneratedKeyHolder();
        jdbc.sql("""
                    INSERT INTO node_checkpoints (node_id, node_version, title, body, script, meta, note, created_by)
                    VALUES (:nodeId, :nodeVersion, :title, :body, :script, :meta, :note, :userId)
                """)
                .param("nodeId", nodeId)
                .param("nodeVersion", nodeVersion)
                .param("title", title.trim())
                .param("body", json.write(body))
                .param("script", json.write(script))
                .param("meta", json.write(meta))
                .param("note", note == null || note.isBlank() ? null : note.trim())
                .param("userId", userId)
                .update(keyHolder);
        return findById(nodeId, IdKeys.id(keyHolder)).orElseThrow();
    }

    private CheckpointRecord map(java.sql.ResultSet rs, int rowNum) throws java.sql.SQLException {
        JsonNode body = json.parse(rs.getString("body"));
        JsonNode script = json.parse(rs.getString("script"));
        JsonNode meta = json.parse(rs.getString("meta"));
        long createdBy = rs.getLong("created_by");
        return new CheckpointRecord(
                rs.getLong("id"),
                rs.getLong("node_id"),
                rs.getLong("node_version"),
                rs.getString("title"),
                body,
                script,
                meta,
                rs.getString("note"),
                createdBy,
                rs.getString("author_name"),
                rs.getTimestamp("created_at").toInstant(),
                WordCounter.count(body, script));
    }
}