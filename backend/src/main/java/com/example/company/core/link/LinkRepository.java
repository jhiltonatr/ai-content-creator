package com.example.company.core.link;

import com.example.company.core.data.IdKeys;
import com.example.company.core.domain.EntityType;
import com.example.company.core.domain.LinkKind;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public class LinkRepository {

    private final JdbcClient jdbc;

    public LinkRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    private static final String COLUMNS = "id, story_id, from_type, from_id, to_type, to_id, kind, created_at";

    public List<LinkRecord> listForStory(long storyId) {
        return jdbc.sql("SELECT " + COLUMNS + " FROM links WHERE story_id = :storyId ORDER BY id")
                .param("storyId", storyId)
                .query(this::map)
                .list();
    }

    public Optional<LinkRecord> findById(long storyId, long id) {
        return jdbc.sql("SELECT " + COLUMNS + " FROM links WHERE id = :id AND story_id = :storyId")
                .param("id", id)
                .param("storyId", storyId)
                .query(this::map)
                .optional();
    }

    public LinkRecord insert(long storyId,
                             EntityType fromType,
                             long fromId,
                             EntityType toType,
                             long toId,
                             LinkKind kind,
                             long userId) {
        GeneratedKeyHolder keyHolder = new GeneratedKeyHolder();
        jdbc.sql("""
                    INSERT INTO links (story_id, from_type, from_id, to_type, to_id, kind, created_by)
                    VALUES (:storyId, :fromType, :fromId, :toType, :toId, :kind, :userId)
                """)
                .param("storyId", storyId)
                .param("fromType", fromType.name())
                .param("fromId", fromId)
                .param("toType", toType.name())
                .param("toId", toId)
                .param("kind", kind.name())
                .param("userId", userId)
                .update(keyHolder);
        long id = IdKeys.id(keyHolder);
        return findById(storyId, id).orElseThrow();
    }

    public void delete(long storyId, long id) {
        jdbc.sql("DELETE FROM links WHERE id = :id AND story_id = :storyId")
                .param("id", id)
                .param("storyId", storyId)
                .update();
    }

    private LinkRecord map(java.sql.ResultSet rs, int rowNum) throws java.sql.SQLException {
        return new LinkRecord(
                rs.getLong("id"),
                rs.getLong("story_id"),
                EntityType.valueOf(rs.getString("from_type")),
                rs.getLong("from_id"),
                EntityType.valueOf(rs.getString("to_type")),
                rs.getLong("to_id"),
                LinkKind.valueOf(rs.getString("kind")),
                rs.getTimestamp("created_at").toInstant());
    }
}