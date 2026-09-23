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
class CheckpointTest extends ApiTestBase {

    private static final String BODY1 = "{\"type\":\"doc\",\"content\":[{\"type\":\"paragraph\","
            + "\"content\":[{\"type\":\"text\",\"text\":\"First words.\"}]}]}";
    private static final String BODY2 = "{\"type\":\"doc\",\"content\":[{\"type\":\"paragraph\","
            + "\"content\":[{\"type\":\"text\",\"text\":\"Second words, rewritten.\"}]}]}";

    private long newChapter(long userId, long storyId, String title) throws Exception {
        MvcResult created = mvc.perform(MockMvcRequestBuilders.post("/api/stories/" + storyId + "/nodes")
                        .header("X-User-Id", userId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nodeType\":\"CHAPTER\",\"title\":\"" + title + "\"}"))
                .andExpect(MockMvcResultMatchers.status().isCreated())
                .andReturn();
        return json(created).get("id").longValue();
    }

    private long checkpoint(long userId, long storyId, long nodeId, String note) throws Exception {
        MvcResult result = mvc.perform(MockMvcRequestBuilders.post(
                        "/api/stories/" + storyId + "/nodes/" + nodeId + "/checkpoints")
                        .header("X-User-Id", userId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(note == null ? "{}" : "{\"note\":\"" + note + "\"}"))
                .andExpect(MockMvcResultMatchers.status().isCreated())
                .andReturn();
        return json(result).get("id").longValue();
    }

    private JsonNode list(long userId, long storyId, long nodeId) throws Exception {
        return json(mvc.perform(MockMvcRequestBuilders.get(
                        "/api/stories/" + storyId + "/nodes/" + nodeId + "/checkpoints")
                        .header("X-User-Id", userId))
                .andExpect(MockMvcResultMatchers.status().isOk())
                .andReturn());
    }

    @Test
    void checkpointsSnapshotContentAndBuildTimeline() throws Exception {
        long alice = newUser("alice-cp@test.example").id();
        long story = createStory(alice, "Checkpoints", "NOVEL");
        long nodeId = newChapter(alice, story, "One");

        long first = checkpoint(alice, story, nodeId, "Opening draft");
        JsonNode detail = json(mvc.perform(MockMvcRequestBuilders.get(
                        "/api/stories/" + story + "/nodes/" + nodeId + "/checkpoints/" + first)
                        .header("X-User-Id", alice))
                .andExpect(MockMvcResultMatchers.status().isOk())
                .andReturn());
        assertThat(detail.get("nodeVersion").longValue()).isEqualTo(1);
        assertThat(detail.get("note").asText()).isEqualTo("Opening draft");
        assertThat(detail.get("authorName").asText()).isEqualToIgnoringCase("alice-cp");
        assertThat(detail.get("body").get("content").get(0).get("content").get(0).get("text").asText())
                .isEqualTo("First words.");
        assertThat(detail.get("wordCount").intValue()).isEqualTo(2);

        mvc.perform(MockMvcRequestBuilders.put("/api/stories/" + story + "/nodes/" + nodeId + "/body")
                        .header("X-User-Id", alice)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"expectedVersion\":1,\"changeId\":\"edit-1\",\"payload\":" + BODY2 + "}"))
                .andExpect(MockMvcResultMatchers.status().isOk());
        long second = checkpoint(alice, story, nodeId, "Rewrite");

        JsonNode timeline = list(alice, story, nodeId);
        assertThat(timeline.size()).isEqualTo(2);
        assertThat(timeline.get(0).get("id").longValue()).isEqualTo(second);
        assertThat(timeline.get(0).get("nodeVersion").longValue()).isEqualTo(2);
        assertThat(timeline.get(0).get("wordCount").intValue()).isEqualTo(3);
        assertThat(timeline.get(1).get("id").longValue()).isEqualTo(first);
        assertThat(timeline.get(1).get("nodeVersion").longValue()).isEqualTo(1);
    }

    @Test
    void restoreRevertsPayloadsAndKeepsAPreRevertCheckpoint() throws Exception {
        long alice = newUser("alice-r@test.example").id();
        long story = createStory(alice, "Restore", "NOVEL");
        long nodeId = newChapter(alice, story, "One");

        long first = checkpoint(alice, story, nodeId, "Draft A");
        mvc.perform(MockMvcRequestBuilders.put("/api/stories/" + story + "/nodes/" + nodeId + "/body")
                        .header("X-User-Id", alice)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"expectedVersion\":1,\"changeId\":\"edit-1\",\"payload\":" + BODY2 + "}"))
                .andExpect(MockMvcResultMatchers.status().isOk());

        MvcResult restored = mvc.perform(MockMvcRequestBuilders.post(
                        "/api/stories/" + story + "/nodes/" + nodeId + "/checkpoints/" + first + "/restore")
                        .header("X-User-Id", alice)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"expectedVersion\":2,\"changeId\":\"revert-1\"}"))
                .andExpect(MockMvcResultMatchers.status().isOk())
                .andReturn();

        JsonNode node = json(restored);
        assertThat(node.get("version").longValue()).isEqualTo(3);
        assertThat(node.get("lastChangeId").asText()).isEqualTo("revert-1");
        assertThat(node.get("body").get("content").get(0).get("content").get(0).get("text").asText())
                .isEqualTo("First words.");

        JsonNode timeline = list(alice, story, nodeId);
        assertThat(timeline.size()).isEqualTo(3);
        assertThat(timeline.get(0).get("nodeVersion").longValue()).isEqualTo(2);
        assertThat(timeline.get(0).get("note").asText()).startsWith("Pre-revert copy");
    }

    @Test
    void restoreReplayIsIdempotent() throws Exception {
        long alice = newUser("alice-ri@test.example").id();
        long story = createStory(alice, "RestoreIdempotent", "NOVEL");
        long nodeId = newChapter(alice, story, "One");
        long first = checkpoint(alice, story, nodeId, "Draft A");

        String restore = "{\"expectedVersion\":1,\"changeId\":\"revert-again\"}";
        MvcResult firstCall = mvc.perform(MockMvcRequestBuilders.post(
                        "/api/stories/" + story + "/nodes/" + nodeId + "/checkpoints/" + first + "/restore")
                        .header("X-User-Id", alice)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(restore))
                .andExpect(MockMvcResultMatchers.status().isOk())
                .andReturn();
        assertThat(json(firstCall).get("version").longValue()).isEqualTo(2);

        MvcResult replay = mvc.perform(MockMvcRequestBuilders.post(
                        "/api/stories/" + story + "/nodes/" + nodeId + "/checkpoints/" + first + "/restore")
                        .header("X-User-Id", alice)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(restore))
                .andExpect(MockMvcResultMatchers.status().isOk())
                .andReturn();
        assertThat(json(replay).get("version").longValue()).isEqualTo(2);
        assertThat(json(replay).get("lastChangeId").asText()).isEqualTo("revert-again");
        assertThat(list(alice, story, nodeId).size()).isEqualTo(2);
    }

    @Test
    void staleRestoreConflictsLikeOtherWrites() throws Exception {
        long alice = newUser("alice-sc@test.example").id();
        long story = createStory(alice, "StaleRestore", "NOVEL");
        long nodeId = newChapter(alice, story, "One");
        long first = checkpoint(alice, story, nodeId, "Draft A");

        mvc.perform(MockMvcRequestBuilders.put("/api/stories/" + story + "/nodes/" + nodeId + "/body")
                        .header("X-User-Id", alice)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"expectedVersion\":1,\"changeId\":\"edit-1\",\"payload\":" + BODY2 + "}"))
                .andExpect(MockMvcResultMatchers.status().isOk());

        MvcResult conflict = mvc.perform(MockMvcRequestBuilders.post(
                        "/api/stories/" + story + "/nodes/" + nodeId + "/checkpoints/" + first + "/restore")
                        .header("X-User-Id", alice)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"expectedVersion\":1,\"changeId\":\"stale-revert\"}"))
                .andExpect(MockMvcResultMatchers.status().isConflict())
                .andReturn();
        JsonNode body = json(conflict);
        assertThat(body.get("error").get("code").asText()).isEqualTo("CONFLICT");
        assertThat(body.get("current").get("version").longValue()).isEqualTo(2);
    }

    @Test
    void checkpointsRespectDraftAccessRoles() throws Exception {
        long alice = newUser("alice-members@test.example").id();
        long viewer = newUser("viewer-cp@test.example").id();
        long editor = newUser("editor-cp@test.example").id();
        long story = createStory(alice, "Gated", "NOVEL");

        mvc.perform(MockMvcRequestBuilders.post("/api/stories/" + story + "/members")
                        .header("X-User-Id", alice)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"viewer-cp@test.example\",\"role\":\"VIEWER\"}"))
                .andExpect(MockMvcResultMatchers.status().isOk());
        mvc.perform(MockMvcRequestBuilders.post("/api/stories/" + story + "/members")
                        .header("X-User-Id", alice)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"editor-cp@test.example\",\"role\":\"EDITOR\"}"))
                .andExpect(MockMvcResultMatchers.status().isOk());

        long nodeId = newChapter(alice, story, "One");
        long checkpointId = checkpoint(alice, story, nodeId, "Draft A");

        mvc.perform(MockMvcRequestBuilders.get("/api/stories/" + story + "/nodes/" + nodeId + "/checkpoints")
                        .header("X-User-Id", viewer))
                .andExpect(MockMvcResultMatchers.status().isForbidden());
        mvc.perform(MockMvcRequestBuilders.post(
                        "/api/stories/" + story + "/nodes/" + nodeId + "/checkpoints/" + checkpointId + "/restore")
                        .header("X-User-Id", viewer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"expectedVersion\":1,\"changeId\":\"viewer-revert\"}"))
                .andExpect(MockMvcResultMatchers.status().isForbidden());

        mvc.perform(MockMvcRequestBuilders.get("/api/stories/" + story + "/nodes/" + nodeId + "/checkpoints")
                        .header("X-User-Id", editor))
                .andExpect(MockMvcResultMatchers.status().isOk());
    }
}