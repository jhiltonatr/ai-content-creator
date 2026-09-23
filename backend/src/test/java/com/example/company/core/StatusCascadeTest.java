package com.example.company.core;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import org.springframework.test.web.servlet.result.MockMvcResultMatchers;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;

import static org.assertj.core.api.Assertions.assertThat;

@Transactional
class StatusCascadeTest extends ApiTestBase {

    private long newNode(long userId, long storyId, String nodeType, String title, Long parentId) throws Exception {
        String parent = parentId == null ? "" : ",\"parentId\":" + parentId;
        MvcResult created = mvc.perform(MockMvcRequestBuilders.post("/api/stories/" + storyId + "/nodes")
                        .header("X-User-Id", userId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nodeType\":\"" + nodeType + "\",\"title\":\"" + title + "\"" + parent + "}"))
                .andExpect(MockMvcResultMatchers.status().isCreated())
                .andReturn();
        return json(created).get("id").longValue();
    }

    private JsonNode node(long userId, long storyId, long nodeId) throws Exception {
        return json(mvc.perform(MockMvcRequestBuilders.get("/api/stories/" + storyId + "/nodes/" + nodeId)
                        .header("X-User-Id", userId))
                .andExpect(MockMvcResultMatchers.status().isOk())
                .andReturn());
    }

    private JsonNode setStatus(long userId, long storyId, long nodeId, long version, String changeId, String status)
            throws Exception {
        MvcResult result = mvc.perform(MockMvcRequestBuilders.put("/api/stories/" + storyId + "/nodes/" + nodeId)
                        .header("X-User-Id", userId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"expectedVersion\":" + version + ",\"changeId\":\"" + changeId
                                + "\",\"status\":\"" + status + "\"}"))
                .andExpect(MockMvcResultMatchers.status().isOk())
                .andReturn();
        return json(result);
    }

    @Test
    void markingAnAncestorDoneCascadesToAllDescendants() throws Exception {
        long alice = newUser("alice-cascade@test.example").id();
        long story = createStory(alice, "Cascade", "NOVEL");

        long book = newNode(alice, story, "BOOK", "Book", null);
        long chapter = newNode(alice, story, "CHAPTER", "Chapter one", book);
        long scene = newNode(alice, story, "SCENE", "Scene one", chapter);
        long sibling = newNode(alice, story, "CHAPTER", "Chapter two", book);

        JsonNode bookFull = setStatus(alice, story, book, 1, "book-done", "DONE");
        assertThat(bookFull.get("version").longValue()).isEqualTo(2);
        assertThat(bookFull.get("status").asText()).isEqualTo("DONE");

        JsonNode chapterFull = node(alice, story, chapter);
        assertThat(chapterFull.get("status").asText()).isEqualTo("DONE");
        assertThat(chapterFull.get("version").longValue()).isEqualTo(2);
        assertThat(chapterFull.get("lastChangeId").asText()).isEqualTo("book-done");

        JsonNode sceneFull = node(alice, story, scene);
        assertThat(sceneFull.get("status").asText()).isEqualTo("DONE");
        assertThat(sceneFull.get("version").longValue()).isEqualTo(2);

        JsonNode siblingFull = node(alice, story, sibling);
        assertThat(siblingFull.get("status").asText()).isEqualTo("DONE");
        assertThat(siblingFull.get("version").longValue()).isEqualTo(2);

        // a release now covers the whole branch
        MvcResult released = mvc.perform(MockMvcRequestBuilders.post("/api/stories/" + story + "/releases")
                        .header("X-User-Id", alice)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Branch\"}"))
                .andExpect(MockMvcResultMatchers.status().isCreated())
                .andReturn();
        assertThat(json(released).get("nodes").size()).isEqualTo(4);
    }

    @Test
    void revertingAnAncestorToDraftLeavesDescendantsDone() throws Exception {
        long alice = newUser("alice-cascade-r@test.example").id();
        long story = createStory(alice, "Cascade revert", "NOVEL");

        long book = newNode(alice, story, "BOOK", "Book", null);
        long chapter = newNode(alice, story, "CHAPTER", "Chapter one", book);

        setStatus(alice, story, book, 1, "book-done", "DONE");
        setStatus(alice, story, book, 2, "book-draft", "DRAFT");

        assertThat(node(alice, story, chapter).get("status").asText()).isEqualTo("DONE");
    }

    @Test
    void duplicateDoneRequestIsIdempotent() throws Exception {
        long alice = newUser("alice-cascade-i@test.example").id();
        long story = createStory(alice, "Cascade idem", "NOVEL");

        long book = newNode(alice, story, "BOOK", "Book", null);
        long chapter = newNode(alice, story, "CHAPTER", "Chapter one", book);

        JsonNode first = setStatus(alice, story, book, 1, "book-done", "DONE");
        assertThat(first.get("version").longValue()).isEqualTo(2);

        // identical request replays idempotently: no version bump, no re-cascade
        JsonNode replay = setStatus(alice, story, book, 1, "book-done", "DONE");
        assertThat(replay.get("version").longValue()).isEqualTo(2);
        assertThat(node(alice, story, chapter).get("version").longValue()).isEqualTo(2);
    }
}