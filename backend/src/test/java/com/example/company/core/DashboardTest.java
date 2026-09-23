package com.example.company.core;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import org.springframework.test.web.servlet.result.MockMvcResultMatchers;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

@Transactional
class DashboardTest extends ApiTestBase {

    @Test
    void aggregatesWholeStoryIntoPerBookRollups() throws Exception {
        long alice = newUser("alice-dash@test.example").id();
        long story = createStory(alice, "Dashboard", "NOVEL");

        long book1 = node(alice, story, "BOOK", "The Year of Ash", null);
        long chapter = node(alice, story, "CHAPTER", "The Clearing", book1);
        long scene = node(alice, story, "SCENE", "First Light", chapter);
        long book2 = node(alice, story, "BOOK", "The Hollow Road", null);

        setBody(alice, story, chapter, "one two three");
        setBody(alice, story, scene, "four five");
        setLanguage(alice, story, chapter, 2, "de");
        setStatus(alice, story, book1, 1, "book1-done", "DONE"); // cascades chapter + scene

        // chapter is the last node mutated, so it leads recent edits deterministically
        setBody(alice, story, chapter, "one two three four");

        JsonNode dash = dashboard(alice, story);

        assertThat(dash.get("title").asText()).isEqualTo("Dashboard");
        assertThat(dash.get("storyType").asText()).isEqualTo("NOVEL");
        assertThat(dash.get("totalWords").longValue()).isEqualTo(4 + 2); // chapter + scene
        assertThat(dash.get("nodeCount").longValue()).isEqualTo(4);
        assertThat(dash.get("draftCount").longValue()).isEqualTo(1);     // book2
        assertThat(dash.get("doneCount").longValue()).isEqualTo(3);      // book1 + subtree

        // languages roll up per node; scene inherits the story default, chapter overrides
        JsonNode languages = dash.get("languages");
        assertThat(languages.size()).isEqualTo(2);
        assertThat(languages.get(0).get("code").asText()).isEqualTo("en");
        assertThat(languages.get(0).get("count").longValue()).isEqualTo(3);
        assertThat(languages.get(1).get("code").asText()).isEqualTo("de");
        assertThat(languages.get(1).get("count").longValue()).isEqualTo(1);

        JsonNode books = dash.get("books");
        assertThat(books.size()).isEqualTo(2);

        JsonNode firstBook = books.get(0);
        assertThat(firstBook.get("node").get("id").longValue()).isEqualTo(book1);
        assertThat(firstBook.get("wordCount").longValue()).isEqualTo(6);
        assertThat(firstBook.get("nodeCount").longValue()).isEqualTo(3);
        assertThat(firstBook.get("draftCount").longValue()).isZero();
        assertThat(firstBook.get("doneCount").longValue()).isEqualTo(3);

        // full subtree in tree order, each entry carrying its own language/status
        JsonNode subtree = firstBook.get("nodes");
        assertThat(subtree.size()).isEqualTo(2);
        assertThat(subtree.get(0).get("id").longValue()).isEqualTo(chapter);
        assertThat(subtree.get(0).get("language").asText()).isEqualTo("de");
        assertThat(subtree.get(0).get("wordCount").longValue()).isEqualTo(4);
        assertThat(subtree.get(0).get("updatedByName").asText()).isEqualTo("alice-dash");
        assertThat(subtree.get(1).get("id").longValue()).isEqualTo(scene);
        assertThat(subtree.get(1).get("language").asText()).isEqualTo("en");
        assertThat(subtree.get(1).get("wordCount").longValue()).isEqualTo(2);

        JsonNode secondBook = books.get(1);
        assertThat(secondBook.get("node").get("id").longValue()).isEqualTo(book2);
        assertThat(secondBook.get("wordCount").longValue()).isZero();
        assertThat(secondBook.get("nodes").size()).isZero();

        JsonNode recentEdits = dash.get("recentEdits");
        assertThat(recentEdits.size()).isEqualTo(4);
        Set<Long> createdIds = new HashSet<>(List.of(book1, chapter, scene, book2));
        for (JsonNode edit : recentEdits) {
            assertThat(createdIds.remove(edit.get("id").longValue())).isTrue();
        }
        // newest edit leads; ties are fine (H2 timestamps can collide in fast tests)
        String newest = recentEdits.get(0).get("updatedAt").asText();
        for (int i = 1; i < recentEdits.size(); i++) {
            assertThat(recentEdits.get(i).get("updatedAt").asText()).isLessThanOrEqualTo(newest);
        }
    }

    @Test
    void editorWithDraftAccessCanReadDashboard() throws Exception {
        long owner = newUser("owner-dash@test.example").id();
        long editor = newUser("editor-dash@test.example").id();
        long story = createStory(owner, "Shared", "NOVEL");
        addMember(owner, story, "editor-dash@test.example", "EDITOR");

        mvc.perform(MockMvcRequestBuilders.get("/api/stories/" + story + "/dashboard")
                        .header("X-User-Id", editor))
                .andExpect(MockMvcResultMatchers.status().isOk())
                .andExpect(MockMvcResultMatchers.jsonPath("$.books").isArray());
    }

    @Test
    void viewerWithoutDraftAccessIsDenied() throws Exception {
        long owner = newUser("viewer-owner-dash@test.example").id();
        long viewer = newUser("viewer-dash@test.example").id();
        long story = createStory(owner, "Guarded", "NOVEL");
        addMember(owner, story, "viewer-dash@test.example", "VIEWER");

        mvc.perform(MockMvcRequestBuilders.get("/api/stories/" + story + "/dashboard")
                        .header("X-User-Id", viewer))
                .andExpect(MockMvcResultMatchers.status().isForbidden());
    }

    private JsonNode dashboard(long userId, long storyId) throws Exception {
        return json(mvc.perform(MockMvcRequestBuilders.get("/api/stories/" + storyId + "/dashboard")
                        .header("X-User-Id", userId))
                .andExpect(MockMvcResultMatchers.status().isOk())
                .andReturn());
    }

    private long node(long userId, long storyId, String nodeType, String title, Long parentId) throws Exception {
        String parent = parentId == null ? "" : ",\"parentId\":" + parentId;
        MvcResult created = mvc.perform(MockMvcRequestBuilders.post("/api/stories/" + storyId + "/nodes")
                        .header("X-User-Id", userId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nodeType\":\"" + nodeType + "\",\"title\":\"" + title + "\"" + parent + "}"))
                .andExpect(MockMvcResultMatchers.status().isCreated())
                .andReturn();
        return json(created).get("id").longValue();
    }

    private JsonNode nodeFull(long userId, long storyId, long nodeId) throws Exception {
        return json(mvc.perform(MockMvcRequestBuilders.get("/api/stories/" + storyId + "/nodes/" + nodeId)
                .header("X-User-Id", userId))
                .andExpect(MockMvcResultMatchers.status().isOk())
                .andReturn());
    }

    private void setBody(long userId, long storyId, long nodeId, String text) throws Exception {
        JsonNode current = nodeFull(userId, storyId, nodeId);
        JsonNode payload = mapper.createObjectNode()
                .put("type", "doc")
                .putArray("content")
                .addObject()
                .put("type", "paragraph")
                .putArray("content")
                .addObject()
                .put("type", "text")
                .put("text", text);
        mvc.perform(MockMvcRequestBuilders.put("/api/stories/" + storyId + "/nodes/" + nodeId + "/body")
                        .header("X-User-Id", userId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"expectedVersion\":" + current.get("version").longValue()
                                + ",\"changeId\":\"body-" + nodeId + "\",\"payload\":" + mapper.writeValueAsString(payload) + "}"))
                .andExpect(MockMvcResultMatchers.status().isOk());
    }

    private void setLanguage(long userId, long storyId, long nodeId, long version, String language) throws Exception {
        mvc.perform(MockMvcRequestBuilders.put("/api/stories/" + storyId + "/nodes/" + nodeId)
                        .header("X-User-Id", userId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"expectedVersion\":" + version + ",\"changeId\":\"lang-" + nodeId
                                + "\",\"language\":\"" + language + "\"}"))
                .andExpect(MockMvcResultMatchers.status().isOk());
    }

    private void setStatus(long userId, long storyId, long nodeId, long version, String changeId, String status)
            throws Exception {
        mvc.perform(MockMvcRequestBuilders.put("/api/stories/" + storyId + "/nodes/" + nodeId)
                        .header("X-User-Id", userId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"expectedVersion\":" + version + ",\"changeId\":\"" + changeId
                                + "\",\"status\":\"" + status + "\"}"))
                .andExpect(MockMvcResultMatchers.status().isOk());
    }

    private void addMember(long ownerId, long storyId, String email, String role) throws Exception {
        mvc.perform(MockMvcRequestBuilders.post("/api/stories/" + storyId + "/members")
                        .header("X-User-Id", ownerId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"role\":\"" + role + "\"}"))
                .andExpect(MockMvcResultMatchers.status().isOk());
    }
}