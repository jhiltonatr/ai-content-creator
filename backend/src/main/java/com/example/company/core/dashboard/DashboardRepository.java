package com.example.company.core.dashboard;

import com.example.company.core.data.JsonSupport;
import com.example.company.core.domain.NodeKind;
import com.example.company.core.domain.NodeStatus;
import com.example.company.core.node.WordCounter;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public class DashboardRepository {

    private final JdbcClient jdbc;
    private final JsonSupport json;

    public DashboardRepository(JdbcClient jdbc, JsonSupport json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    /**
     * Every node of the story, in tree order, with the updating user's display name
     * joined for display only. {@code defaultLanguage} resolves each node's effective
     * language so the dashboard never has to special-case {@code null} overrides.
     */
    public List<DashboardNode> listForStory(long storyId, String defaultLanguage) {
        return jdbc.sql("""
                    SELECT n.id, n.parent_id, n.node_type, n.title, n.status, n.language,
                           n.body, n.script, n.updated_at, n.updated_by, u.display_name AS updated_by_name
                    FROM nodes n
                    JOIN users u ON u.id = n.updated_by
                    WHERE n.story_id = :storyId
                    ORDER BY n.sort_order, n.id
                """)
                .param("storyId", storyId)
                .query((rs, rowNum) -> {
                    tools.jackson.databind.JsonNode body = json.parse(rs.getString("body"));
                    tools.jackson.databind.JsonNode script = json.parse(rs.getString("script"));
                    String override = rs.getString("language");
                    String language = override == null || override.isBlank() ? defaultLanguage : override;
                    return new DashboardNode(
                            rs.getLong("id"),
                            (Long) rs.getObject("parent_id"),
                            NodeKind.valueOf(rs.getString("node_type")),
                            rs.getString("title"),
                            NodeStatus.valueOf(rs.getString("status")),
                            language,
                            WordCounter.count(body, script),
                            rs.getTimestamp("updated_at").toInstant(),
                            rs.getLong("updated_by"),
                            rs.getString("updated_by_name"));
                })
                .list();
    }
}